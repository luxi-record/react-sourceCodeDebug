import {Component, useContext} from 'react'
import { Outlet } from 'react-router-dom'
import { Nav } from './App'

export default class Childs extends Component {
    constructor(props){
        super(props)
        this.state = {
            name: 'class'
        }
    }
    componentDidMount(){
        console.log('mount class')
        console.warn(this.context)
    }
    componentDidUpdate(){
        console.log('class update')
    }
    getSnapshotBeforeUpdate(){
        console.log('class getSnapshotBeforeUpdate')
        return
    }
    change = () => {
        this.setState({name: 'classChange'})
    }
    render() {
        return(
            <div onClick={this.change}>我是class组件
                <div>
                    woshioutle:
                    <Outlet />
                </div>
            </div>
        )
    }
}