import React from "react";
import intl from "react-intl-universal";

import SelectLocale from "./SelectLocale";
import messages from "./messages";

export const App = (props) => {
    return <div>
        <SelectLocale locale={props.locale}/>
        {intl.formatMessage({...messages.hello})}
        <Greeting/>
    </div>
}

export class Greeting extends React.Component {
    constructor(props, context) {
        super(props, context);
        this.onChage = this.onChage.bind(this);

        this.state = {
            name: ''
        }
    }

    onChage(e) {
        this.setState({
            name: e.target.value,
        })
    }

    render() {
        return <div style={{paddingTop: '40px'}}>
            <label htmlFor="nickname">{intl.formatMessage({...messages.label})}</label>
            <input id="nickname" value={this.state.name} onChange={this.onChage}/>
            {this.state.name ? <div style={{paddingLeft: '15px'}}>
                {intl.formatMessage({...messages.greeting}, {
                    name: this.state.name
                })}
            </div> : null}
        </div>
    }

}
export default App;
