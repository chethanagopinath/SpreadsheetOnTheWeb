//-*- mode: rjsx-mode;

import { indexToRowSpec, indexToColSpec } from 'cs544-ss';
import popupMenu from '../lib/menu.jsx';
import SingleInput from './single-input.jsx';

import React from 'react';
import ReactDom from 'react-dom';

/************************ Spreadsheet Component ************************/

const [N_ROWS, N_COLS] = [10, 10];
const ROW_HDRS = Array.from({ length: N_ROWS }).map((_, i) =>
  indexToRowSpec(i)
);
const COL_HDRS = Array.from({ length: N_COLS }).map((_, i) =>
  indexToColSpec(i).toUpperCase()
);

export default class Spreadsheet extends React.Component {
  constructor(props) {
    super(props);
    //Set initial state 
    this.state = {
      currentCellId: '',
      counter: 0,
      copyCellId: '',
      error: '',
    };

    this.update = this.update.bind(this);
    this.onFocus = this.onFocus.bind(this);
    this.onContextMenuSpreadsheetName = this.onContextMenuSpreadsheetName.bind(this);
    this.onContextMenuSpreadsheetCell = this.onContextMenuSpreadsheetCell.bind(this);
  }

  //Handler for context menu item on spreadsheet name
  onContextMenuSpreadsheetName(event) {
    event.preventDefault();
    popupMenu(event, {
      menuItems: [
        {
          menuLabel: 'Clear',
          menuItemFn: async () => {
            //Calling spreadsheet class method clear() on spreadsheet instance
            await this.props.spreadsheet.clear();
            //Updating counter for re-rendering
            this.setState({ counter: this.state.counter++ });
          },
        },
      ],
    });
  }


  onContextMenuSpreadsheetCell(event) {
      //Disabling default right-click menu showing up on page
      event.preventDefault();
      
      const {currentCellId, copyCellId} = this.state;
      //Setting flag to true if currently focused cell id has formula, else false 
      const currentCellHasFormula = !!this.props.spreadsheet.query(currentCellId).formula;
      
      //Setting flag to true if copied cell id has formula, else false 
      const copyCellHasFormula = !!this.props.spreadsheet.query(copyCellId).formula;
      
      /**
      * menuLabel => check if currently focused cell has formula, else display a general 'Copy'
      *              label when Copy action is disabled
      * menuItemFn => set to null if currently focused/copied cell does not have formula, else 
      *               appropriate methods are called on the spreadsheet instance for Delete and 
      *               Paste, and the currentCellId is copied on to copyCellId for Copy
      * ERROR HANDLING
      * Delete => Catch any error thrown by the promise and set the state's error property
      * Paste => Catch any app error(s) from spreadsheet instance's copy() method
      */
      popupMenu(event, {
        menuItems: [
          {
            
            menuLabel: !currentCellHasFormula ? 'Copy' : `Copy ${currentCellId.toUpperCase()}`,
            
            //Copy => if currentCellId's formula is empty, copy should be disabled 
            menuItemFn: !currentCellHasFormula ? null : () => {
              this.setState({
                counter: this.state.counter++,
                copyCellId: currentCellId,
              });
            },
          },
          // Delete => if currentCellId's formula is empty, delete should be disabled
          {
            menuLabel: !currentCellHasFormula ? 'Delete' : `Delete ${currentCellId.toUpperCase()}`,
            menuItemFn: !currentCellHasFormula ? null : async () => {
            try{
              await this.props.spreadsheet.delete(currentCellId);
              this.setState({ counter: this.state.counter++ });
            } catch(error){
                this.setState({ error: error.message });
            }  
            },
          },
          //Paste => if copyCellId's formula is empty, paste should be disabled
          {
            menuLabel: !copyCellHasFormula ? 'Paste' : `Paste ${copyCellId.toUpperCase()} to ${currentCellId.toUpperCase()}`,
            menuItemFn: !copyCellHasFormula ? null : async () => {
            try{
              await this.props.spreadsheet.copy(
                currentCellId,
                copyCellId
              );
              this.setState({ counter: this.state.counter++ });
            } catch(error){
                this.setState({ error: error.message });
            }
              
            },
          },
        ],
      });
  }

  //Clearing error when focusing on a new cell and changing currentCellId to the currently focused cell
  onFocus(event) {
    this.setState({ currentCellId: event.target.getAttribute('data-cellid'), error: '' });
  }

  //Updating input field with formula of currently focused cell
  async update(formula) {
    await this.props.spreadsheet.eval(this.state.currentCellId, formula);
    this.setState({ counter: this.state.counter++ });
  }

  render() {
    const valueFormulas = this.props.spreadsheet.valueFormulas();
    let tabIndex = 0;
    const currentCell = valueFormulas[this.state.currentCellId];
    const currentFormula = currentCell ? currentCell.formula : '';
    
    return (
      <>
        <SingleInput
          id='formula'
          label={this.state.currentCellId.toUpperCase()}
          value={currentFormula}
          update={this.update}
        />
        <table className='ss'>
          <thead>
            <tr>
              {/*Rendering spreadsheet name along with clear context menu option*/}
              <th onContextMenu={this.onContextMenuSpreadsheetName}>
                {this.props.spreadsheet.name}
              </th>
              {COL_HDRS.map((col) => (
                //Rendering column headers A..J
                <th key={col}> {col} </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/*Rendering row headers and also every other cell by calling SSCell component*/}
            {ROW_HDRS.map((row, index) => (
              <tr key={row}>
                <th> {row} </th>
                {COL_HDRS.map((col) => {
                  //Generating tabIndex by incrementing within each iteration
                  tabIndex++;

                  //Dynamically generating cellid for each cell based on col and row
                  const cellId = `${col}${row}`.toLowerCase();
                  
                  //Adding classNames for styling
                  const className = [];
                  if(this.state.currentCellId === cellId){
                    className.push('focused');
                  } 
                  if(this.state.copyCellId === cellId){
                    className.push('copied');
                  }

                  //Passing current cell id, value and formula as props to SSCell
                  const cellValFormula = valueFormulas[cellId];
                  const formula = cellValFormula ? cellValFormula.formula : '';
                  const value = cellValFormula ? cellValFormula.value : '';
                  return (
                    <SSCell
                      key={cellId}
                      cellId={cellId}
                      formula={formula}
                      value={value}
                      tabIndex={tabIndex}
                      onFocus={this.onFocus}
                      className={className.join(' ')}
                      onContextMenu={this.onContextMenuSpreadsheetCell}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="error">{this.state.error}</div>
      </>
    );
  }
}

function SSCell(props) {
  const {
    cellId,
    formula,
    value,
    onContextMenu,
    onFocus,
    className,
    tabIndex,
  } = props;
  return (
    <td
      onContextMenu={onContextMenu}
      data-cellid={cellId}
      onFocus={onFocus}
      className={className}
      tabIndex={tabIndex}
      title={formula ?? ''}>
      {value ?? ''}
    </td>
  );
}
