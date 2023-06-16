/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {AnyNativeEvent} from '../events/PluginModuleType';
import type {FiberRoot} from 'react-reconciler/src/ReactInternalTypes';
import type {Container, SuspenseInstance} from '../client/ReactDOMHostConfig';
import type {DOMEventName} from '../events/DOMEventNames';
import {
  isDiscreteEventThatRequiresHydration,
  clearIfContinuousEvent,
  queueIfContinuousEvent,
  attemptSynchronousHydration,
} from './ReactDOMEventReplaying';
import {
  getNearestMountedFiber,
  getContainerFromFiber,
  getSuspenseInstanceFromFiber,
} from 'react-reconciler/src/ReactFiberTreeReflection';
import {HostRoot, SuspenseComponent} from 'react-reconciler/src/ReactWorkTags';
import {type EventSystemFlags, IS_CAPTURE_PHASE} from './EventSystemFlags';

import getEventTarget from './getEventTarget';
import {
  getInstanceFromNode,
  getClosestInstanceFromNode,
} from '../client/ReactDOMComponentTree';

import {dispatchEventForPluginEventSystem} from './DOMPluginEventSystem';

import {
  getCurrentPriorityLevel as getCurrentSchedulerPriorityLevel,
  IdlePriority as IdleSchedulerPriority,
  ImmediatePriority as ImmediateSchedulerPriority,
  LowPriority as LowSchedulerPriority,
  NormalPriority as NormalSchedulerPriority,
  UserBlockingPriority as UserBlockingSchedulerPriority,
} from 'react-reconciler/src/Scheduler';
import {
  DiscreteEventPriority,
  ContinuousEventPriority,
  DefaultEventPriority,
  IdleEventPriority,
  getCurrentUpdatePriority,
  setCurrentUpdatePriority,
} from 'react-reconciler/src/ReactEventPriorities';
import ReactSharedInternals from 'shared/ReactSharedInternals';
import {isRootDehydrated} from 'react-reconciler/src/ReactFiberShellHydration';

const {ReactCurrentBatchConfig} = ReactSharedInternals;

// TODO: can we stop exporting these?
export let _enabled = true;

// This is exported in FB builds for use by legacy FB layer infra.
// We'd like to remove this but it's not clear if this is safe.
export function setEnabled(enabled: ?boolean) {
  _enabled = !!enabled;
}

export function isEnabled() {
  return _enabled;
}

export function createEventListenerWrapper(
  targetContainer: EventTarget,
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
): Function {
  return dispatchEvent.bind(
    null,
    domEventName,
    eventSystemFlags,
    targetContainer,
  );
}
let log = 0
export function createEventListenerWrapperWithPriority(
  targetContainer: EventTarget,
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
): Function {
  if(log === 0) {
    console.log('createEventListenerWrapperWithPriority会通过事件名调用getEventPriority获取该事件的优先级')
    console.warn('主要有三种优先级，从高到低分别是DiscreteEventPriority，ContinuousEventPriority，DefaultEventPriority',DiscreteEventPriority,ContinuousEventPriority,DefaultEventPriority)
    console.log('像鼠标点击，键盘输入等被列为最高优先级，像鼠标移动，滚动鼠标等被列为第二优先级，这三种优先级对应着不同的listener')
    console.warn(`当触发这三种listener时候本质都会调用dispatchEvent，不同的是除了默认优先级，
    其余两种优先级都会先获取当前更新优先级赋值给一个变量previousPriority，再把当前更新优先级设置触发当前事件的优先级，再去触发dispatchEvent，最后再把当前优先级设置有previousPriority`)
    log = 1
  }
  const eventPriority = getEventPriority(domEventName);
  let listenerWrapper;
  // 根据事件名注册不同的dispatch函数
  switch (eventPriority) {
    case DiscreteEventPriority: //最高优先级sync，第一车道
      listenerWrapper = dispatchDiscreteEvent;
      break;
    case ContinuousEventPriority: //第三车道优先级
      listenerWrapper = dispatchContinuousEvent;
      break;
    case DefaultEventPriority:// 最低优先级第五车道
    default:
      listenerWrapper = dispatchEvent;
      break;
  }
  return listenerWrapper.bind(
    null,
    domEventName,
    eventSystemFlags,
    targetContainer,
  );
}
// click事件等
function dispatchDiscreteEvent(
  domEventName,
  eventSystemFlags,
  container,
  nativeEvent,
) {
  const previousPriority = getCurrentUpdatePriority();
  const prevTransition = ReactCurrentBatchConfig.transition;
  ReactCurrentBatchConfig.transition = null;
  try {
    setCurrentUpdatePriority(DiscreteEventPriority);
    dispatchEvent(domEventName, eventSystemFlags, container, nativeEvent);
  } finally {
    setCurrentUpdatePriority(previousPriority);
    ReactCurrentBatchConfig.transition = prevTransition;
  }
}

function dispatchContinuousEvent(
  domEventName,
  eventSystemFlags,
  container,
  nativeEvent,
) {
  const previousPriority = getCurrentUpdatePriority();
  const prevTransition = ReactCurrentBatchConfig.transition;
  ReactCurrentBatchConfig.transition = null;
  try {
    setCurrentUpdatePriority(ContinuousEventPriority);
    dispatchEvent(domEventName, eventSystemFlags, container, nativeEvent);
  } finally {
    setCurrentUpdatePriority(previousPriority);
    ReactCurrentBatchConfig.transition = prevTransition;
  }
}
// 触发事件
function dispatchEvent(
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  targetContainer: EventTarget,
  nativeEvent: AnyNativeEvent,
) {
  // findInstanceBlockingEvent会找到触发事件的dom和fiber
  let blockedOn = findInstanceBlockingEvent(
    domEventName,
    eventSystemFlags,
    targetContainer,
    nativeEvent,
  );
  if (blockedOn === null) {
    //触发的主要函数
    dispatchEventForPluginEventSystem(
      domEventName,
      eventSystemFlags,
      nativeEvent,
      return_targetInst,
      targetContainer,
    );
    clearIfContinuousEvent(domEventName, nativeEvent);
    return;
  }

  if (
    queueIfContinuousEvent(
      blockedOn,
      domEventName,
      eventSystemFlags,
      targetContainer,
      nativeEvent,
    )
  ) {
    nativeEvent.stopPropagation();
    return;
  }
  // We need to clear only if we didn't queue because
  // queueing is accumulative.
  clearIfContinuousEvent(domEventName, nativeEvent);

  if (
    eventSystemFlags & IS_CAPTURE_PHASE &&
    isDiscreteEventThatRequiresHydration(domEventName)
  ) {
    while (blockedOn !== null) {
      const fiber = getInstanceFromNode(blockedOn);
      if (fiber !== null) {
        attemptSynchronousHydration(fiber);
      }
      const nextBlockedOn = findInstanceBlockingEvent(
        domEventName,
        eventSystemFlags,
        targetContainer,
        nativeEvent,
      );
      if (nextBlockedOn === null) {
        dispatchEventForPluginEventSystem(
          domEventName,
          eventSystemFlags,
          nativeEvent,
          return_targetInst,
          targetContainer,
        );
      }
      if (nextBlockedOn === blockedOn) {
        break;
      }
      blockedOn = nextBlockedOn;
    }
    if (blockedOn !== null) {
      nativeEvent.stopPropagation();
    }
    return;
  }

  // This is not replayable so we'll invoke it but without a target,
  // in case the event system needs to trace it.
  dispatchEventForPluginEventSystem(
    domEventName,
    eventSystemFlags,
    nativeEvent,
    null,
    targetContainer,
  );
}

let return_targetInst = null;

// Returns a SuspenseInstance or Container if it's blocked.
// The return_targetInst field above is conceptually part of the return value.
export function findInstanceBlockingEvent(
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  targetContainer: EventTarget,
  nativeEvent: AnyNativeEvent,
): null | Container | SuspenseInstance {
  // TODO: Warn if _enabled is false.

  return_targetInst = null;
  const nativeEventTarget = getEventTarget(nativeEvent);
  let targetInst = getClosestInstanceFromNode(nativeEventTarget);

  if (targetInst !== null) {
    const nearestMounted = getNearestMountedFiber(targetInst);
    if (nearestMounted === null) {
      // This tree has been unmounted already. Dispatch without a target.
      targetInst = null;
    } else {
      const tag = nearestMounted.tag;
      if (tag === SuspenseComponent) {
        const instance = getSuspenseInstanceFromFiber(nearestMounted);
        if (instance !== null) {
          // Queue the event to be replayed later. Abort dispatching since we
          // don't want this event dispatched twice through the event system.
          // TODO: If this is the first discrete event in the queue. Schedule an increased
          // priority for this boundary.
          return instance;
        }
        // This shouldn't happen, something went wrong but to avoid blocking
        // the whole system, dispatch the event without a target.
        // TODO: Warn.
        targetInst = null;
      } else if (tag === HostRoot) {
        const root: FiberRoot = nearestMounted.stateNode;
        if (isRootDehydrated(root)) {
          // If this happens during a replay something went wrong and it might block
          // the whole system.
          return getContainerFromFiber(nearestMounted);
        }
        targetInst = null;
      } else if (nearestMounted !== targetInst) {
        // If we get an event (ex: img onload) before committing that
        // component's mount, ignore it for now (that is, treat it as if it was an
        // event on a non-React tree). We might also consider queueing events and
        // dispatching them after the mount.
        targetInst = null;
      }
    }
  }
  return_targetInst = targetInst;
  // We're not blocked on anything.
  return null;
}

export function getEventPriority(domEventName: DOMEventName): * {
  switch (domEventName) {
    // Used by SimpleEventPlugin:
    case 'cancel':
    case 'click':
    case 'close':
    case 'contextmenu':
    case 'copy':
    case 'cut':
    case 'auxclick':
    case 'dblclick':
    case 'dragend':
    case 'dragstart':
    case 'drop':
    case 'focusin':
    case 'focusout':
    case 'input':
    case 'invalid':
    case 'keydown':
    case 'keypress':
    case 'keyup':
    case 'mousedown':
    case 'mouseup':
    case 'paste':
    case 'pause':
    case 'play':
    case 'pointercancel':
    case 'pointerdown':
    case 'pointerup':
    case 'ratechange':
    case 'reset':
    case 'resize':
    case 'seeked':
    case 'submit':
    case 'touchcancel':
    case 'touchend':
    case 'touchstart':
    case 'volumechange':
    // Used by polyfills:
    // eslint-disable-next-line no-fallthrough
    case 'change':
    case 'selectionchange':
    case 'textInput':
    case 'compositionstart':
    case 'compositionend':
    case 'compositionupdate':
    // Only enableCreateEventHandleAPI:
    // eslint-disable-next-line no-fallthrough
    case 'beforeblur':
    case 'afterblur':
    // Not used by React but could be by user code:
    // eslint-disable-next-line no-fallthrough
    case 'beforeinput':
    case 'blur':
    case 'fullscreenchange':
    case 'focus':
    case 'hashchange':
    case 'popstate':
    case 'select':
    case 'selectstart':
      return DiscreteEventPriority;
    case 'drag':
    case 'dragenter':
    case 'dragexit':
    case 'dragleave':
    case 'dragover':
    case 'mousemove':
    case 'mouseout':
    case 'mouseover':
    case 'pointermove':
    case 'pointerout':
    case 'pointerover':
    case 'scroll':
    case 'toggle':
    case 'touchmove':
    case 'wheel':
    // Not used by React but could be by user code:
    // eslint-disable-next-line no-fallthrough
    case 'mouseenter':
    case 'mouseleave':
    case 'pointerenter':
    case 'pointerleave':
      return ContinuousEventPriority;
    case 'message': {
      // We might be in the Scheduler callback.
      // Eventually this mechanism will be replaced by a check
      // of the current priority on the native scheduler.
      const schedulerPriority = getCurrentSchedulerPriorityLevel();
      switch (schedulerPriority) {
        case ImmediateSchedulerPriority:
          return DiscreteEventPriority;
        case UserBlockingSchedulerPriority:
          return ContinuousEventPriority;
        case NormalSchedulerPriority:
        case LowSchedulerPriority:
          // TODO: Handle LowSchedulerPriority, somehow. Maybe the same lane as hydration.
          return DefaultEventPriority;
        case IdleSchedulerPriority:
          return IdleEventPriority;
        default:
          return DefaultEventPriority;
      }
    }
    default:
      return DefaultEventPriority;
  }
}
