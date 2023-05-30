import { useContext, useState, useEffect } from "react"
import { useOutlet, Outlet, UNSAFE_RouteContext, HashRouter } from 'react-router-dom'
import { Nav } from './App'

export default function Button (props) {
    const {fn} = props
    console.log('2red')
    const { history } = useContext(Nav)
    console.warn(useContext(Nav))
    const [st, s] = useState(2.22)
    const [sts, ss] = useState(3.21)
    const fns = () => {
        setTimeout(() => {
            s(Math.random())
        }, 10)
        setTimeout(() => {
            s(Math.random())
        }, 15)
    }
    useEffect(() => {
        const unblock = history.block((fn) => {
            console.warn(fn)
            setTimeout(() => {
                unblock()
                fn()
            }, 1000)
        })
    }, [])
    return(
        <div>
            <button onClick={fn}>父组件更新</button>
            <button onClick={fns}>子组件更新{sts.toFixed(2) + st.toFixed(2)}</button>
        </div>
    )
}
 