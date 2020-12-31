//-*- mode: rjsx-mode;

import SingleInput from './single-input.jsx';
import {Spreadsheet} from 'cs544-ss';
import SS from './spreadsheet.jsx';

import React from 'react';
import ReactDom from 'react-dom';


/*************************** App Component ***************************/

const STORE = window.localStorage;

export default class App extends React.Component {

  constructor(props) {
    super(props);

    this.update = this.update.bind(this);

    this.state = {
      ssName: '',
      spreadsheet: null,
    };
  }


  componentDidCatch(error, info) {
    console.error(error, info);
  }
  
  async update(ssName) {
    //Validating spreadsheet name using regex and throwing an error if empty or invalid
    const validator = {
      err: val => !/^[\w\- ]+$/.test(val) && `
        Bad spreadsheet name "${val}": must contain only alphanumeric characters, underscore, hyphen or space.`,
    }
    if(!ssName){
      throw new Error('The Spreadsheet Name field must be specified');
    }
    const error = validator.err(ssName);
    if (error) {
      throw new Error(error);
    }
    
    //Creating spreadsheet instance if ssName is valid and updating state
    const ss = await Spreadsheet.make(ssName, this.props.ssClient);
    this.setState({ spreadsheet : ss});

  }


  render() {
    const { ssName, spreadsheet } = this.state;
    const ss =
      (spreadsheet) ?  <SS spreadsheet={spreadsheet}/> : '';
    return (
      <div>
        <SingleInput id="ssName" label="Open Spreadsheet Name"
                     value={ssName} update={this.update}/>
        {ss}
     </div>
     );
  }

}
