//-*- mode: rjsx-mode;

import React from 'react';
import ReactDom from 'react-dom';

/** Component which displays a single input widget having the following
 *  props:
 *
 *    `id`:     The id associated with the <input> element.
 *    `value`:  An initial value for the widget (defaults to '').
 *    `label`:  The label displayed for the widget.
 *    `update`: A handler called with the `value` of the <input>
 *              widget whenever it is blurred or its containing
 *              form submitted.
 */
export default class SingleInput extends React.Component {

  constructor(props) {
    super(props);
    //Setting initial state
    this.state = { 
	    value: this.props.value || '', 
	    error: ''
    }
   
    this.onChange = this.onChange.bind(this);
    this.onUpdate = this.onUpdate.bind(this);
  }

  //Called after props update as the component is reused
  componentDidUpdate(prevProps) {
  if (this.props.value !== prevProps.value) {
    this.setState({value: this.props.value, error: ''});
  }
}	

  //Fills in the state from updating input field of the app or spreadsheet, as SingleInput is reused
  async onUpdate(event){
  try{
	  	event.preventDefault();
	  	await this.props.update(this.state.value);
  	} catch(error) {
  		this.setState({ error: error.message });
  	}
  	
  }
  //Update value of state when value on input field changes
  onChange(event){
  	this.setState({ value: event.target.value, error: '' });
  }

  render() { 
    return (
    	<form onSubmit={this.onUpdate}>
    		<label htmlFor={this.props.id}> {this.props.label} </label>
    		<span>
    			<input id={this.props.id} value={this.state.value} onChange={this.onChange} onBlur={this.onUpdate} />
    			<br/>
    			<span className="error">{this.state.error}</span>
    		</span>
    	</form>
    );
  }

}
