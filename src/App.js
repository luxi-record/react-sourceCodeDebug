import { useEffect, useState, React, useLayoutEffect, useContext, createContext, useCallback, useTransition } from 'react';
// import * as React from 'react';
import './App.css';
import Button from './APP2';
import Childs from './App3';
import { Routes, Route, UNSAFE_NavigationContext, useNavigate, useNavigation, Link, Navigate } from 'react-router-dom'
import App4 from './App4';

const Nav = createContext(null) 
export { Nav }
function App() {
  console.log('APP render all')
  const {navigator} = useContext(UNSAFE_NavigationContext)
  console.warn(navigator)
  const wrap = (nav) => {
    const history = nav
    const push = nav.push
    history.blockTasks = []
    history.block = (fn) => {
      history.blockTasks.push(fn)
      window.addEventListener('beforeunload', (e) => {
        e.preventDefault()
        e.returnValue = ''
        fn()
      })
      window.addEventListener('popstate', () => {
        fn()
      })
      return () => history.blockTasks = history.blockTasks.filter((val) => val !== fn)
    }
    history.push = function (...args) {
      if (history.blockTasks.length) {
        history.blockTasks.forEach((fn) => {
          fn(() => push(...args))
        })
      } else {
        push(...args)
      }
    }
    return history
  }
  // const go = useNavigate()
  const [state, set] = useState('i am one state')
  const [s2, set2] = useState('i am two state')
  const fn = function () {
    set(Math.random())
    set2(Math.random())
  }
  const async = () => {
    setTimeout(() => {
      set(Math.random())
    }, 300)
    setTimeout(() => {
      set2(Math.random())
    }, 301)
  }
  const fs = () => {
    set(Math.random())
  }
  const fac = () => {
    set(Math.random())
  }
  useEffect(() => {
    document.getElementById('dom').addEventListener('click', () => {
      set(Math.random())
      set2(Math.random())
    })
    console.log('log: app effect')
    // set(1)
  }, [])
  useLayoutEffect(() => {
    console.log('log： app layouteffect')
    return () => { console.log('destory layout') }
  }, [])

  return (
    <>
    <Nav.Provider value={{history: wrap(navigator)}}>
      <Routes>
        <Route path='/sa' element={<p>说我是sa</p>}>
          <Route path='sd' element={<p>我是sd</p>}></Route>
        </Route>
        <Route path='/s' element={<Button fn={fn}></Button>}>
          <Route path='b' element={<p>我是sb</p>}></Route>
        </Route>
        <Route path='/app4' element={<App4/>}></Route>
      </Routes>
      <div className="App" onKeyDown={fac}>
        <Link to={'/s/b'}>s/b</Link>
        <hr />
        <Link to={'/sa'}>sa</Link>
        <hr />
        <Link to={'/s'}>s</Link>
        <hr />
        <Link to={'/sa/sd'}>sa/sd</Link>
        <hr />
        <Link to={'/app4'}>App4</Link>
        {/* <button id={'dom'}>按钮原生事件</button>
        <button onClick={async}>按钮异步事件</button>
        <input value={s2} onFocus={fs} onChange={(e) => set2(e.target.value)} onKeyDown={fs}></input>
        <button onClick={() => go('/')}>go home</button> */}
      </div>
    </Nav.Provider>
      <button id={'dom'}>按钮原生事件</button>
      <button onClick={async}>按钮异步事件</button>
      <input value={s2} onFocus={fs} onChange={(e) => set2(e.target.value)} onKeyDown={fs}></input>
    </>
  );
}

function AppTest () {
  const [state, setState] = useState('state1')
  const [state2, setState2] = useState('state2')
  useEffect(() => {
    console.log('我是没有依赖的useEffect')
    document.getElementById('but').addEventListener('click', navClick)
    return () => console.log('我是没有依赖的useEffect的清除函数')
  }, [])
  useLayoutEffect(() => {
    console.log('我是没有依赖的useLayoutEffect')
    return () => console.log('我是没有依赖的useLayoutEffect的清除函数')
  }, [])
  useEffect(() => {
    console.log('我是每次更新都要执行的useEffect')
    return () => console.log('我是每次更新都要执行的useEffect清除')
  })
  const click = () => {
    setState('change1')
    setState2('change2')
  }
  const navClick = () => {
    setState('change1')
    setState2('change2')
  }
  const time = () => {
    setTimeout(() => {
      setState('changeTime')
      setState2('changeTime2')
    }, 200)
  }
  return (
    <div>
      <span>state1：{state}</span>
      <span>state2：{state2}</span>
      <button onClick={click}>react事件</button>
      <button id='but'>原生事件</button>
      <button onClick={time}>延迟事件</button>
      <Component />
    </div>
  )
}

function Component () {
  const [state, setstate] = useState('child state')
  const [inp, setInp] = useState('input')
  const [isPending, startTransition] = useTransition()
  const callback = useCallback(() => {
    setTimeout(() => {
      alert(state)
    }, 3000)
  }, [state])
  const spanClick = (e) => {
    console.log('span click')
  }
  const divClick = () => {
    console.log('div click')
  }
  const changeInput = (e) => {
    const val = e.target.value
    setInp(val)
    startTransition(() => {
      setstate(Math.random())
    })
  }
  return (
    <div style={{border: 'solid 1px red'}} onClick={divClick}>
      <span onClick={spanClick}>{state}</span>
      <button onClick={() => setstate(Math.random())}>change state</button>
      <button onClick={callback}>alert</button>
      <span>isPending:{`${isPending}`}</span>
      <input value={inp} onChange={changeInput} />
    </div>
  )
}

export default AppTest;
