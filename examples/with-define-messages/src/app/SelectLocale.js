/* origin - react-intl-universal/examples/src/App.js  */
import React from "react";
import _ from "lodash";
import http from "axios";

import {SUPPORTED_LOCALES} from "../i18n";

class SelectLocale extends React.Component {

    constructor(props) {
        super(props);
        this.onSelectLocale = this.onSelectLocale.bind(this);
    }

    render() {
        return (
            <div>
                {this.renderLocaleSelector()}
            </div>
        );
    }

    renderLocaleSelector() {
        return (
            <select onChange={this.onSelectLocale} defaultValue={this.props.locale}>
                <option value="" disabled>Change Language</option>
                {SUPPORTED_LOCALES.map(locale => (
                    <option key={locale} value={locale}>{locale}</option>
                ))}
            </select>
        );
    }

    onSelectLocale(e) {
        let lang = e.target.value;
        location.search = `?lang=${lang}`;
    }
}

export default SelectLocale;