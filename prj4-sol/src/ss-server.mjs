import Path from 'path';

import express from 'express';
import bodyParser from 'body-parser';

import querystring from 'querystring';

import {AppError, Spreadsheet} from 'cs544-ss';

import Mustache from './mustache.mjs';

const STATIC_DIR = 'statics';
const TEMPLATES_DIR = 'templates';

//some common HTTP status codes; not all codes may be necessary
const OK = 200;
const CREATED = 201;
const NO_CONTENT = 204;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const CONFLICT = 409;
const SERVER_ERROR = 500;

const __dirname = Path.dirname(new URL(import.meta.url).pathname);

export default function serve(port, store) {
  process.chdir(__dirname);
  const app = express();
  app.locals.port = port;
  app.locals.store = store;
  app.locals.mustache = new Mustache();
  app.use('/', express.static(STATIC_DIR));
  setupRoutes(app);
  app.listen(port, function() {
    console.log(`listening on port ${port}`);
  });
}


/*********************** Routes and Handlers ***************************/

function setupRoutes(app) {
  app.use(bodyParser.urlencoded({extended: true}));
  
  app.get('/', doRenderSSOpenPage(app));
  app.post('/', doSubmitSSOpenPage(app));
  app.get('/ss/:ssName', doRenderSSUpdatePage(app));
  app.post('/ss/:ssName', doSubmitSSUpdatePage(app));
  //must be last
  app.use(do404(app));
  app.use(doErrors(app));

}

//Handler for rendering the spreadsheet open page

function doRenderSSOpenPage(app){
  return async function(req, res){
    res.status(OK).
      send(app.locals.mustache.render('spreadsheet-open', {}));
  }
}

//Handler to call spreadsheet name validation and also handle routing to the next logical page

function doSubmitSSOpenPage(app){
  return async function(req, res){
    const errors = {};
    const {ssName} = trimValues(req.body);
    const validated = validateField("ssName", req.body, errors);
    if (!validated){
      const rendered = app.locals.mustache.render(
      'spreadsheet-open', 
      { errors: [{ msg: errors.ssName, }], ssName  });
      res.send(rendered);
    }
    else{
      res.redirect(`/ss/${ssName}`);
    } 
    
  }
}

//Handler to render spreadsheet update page

function doRenderSSUpdatePage(app){
  return async function(req, res){
    const ssName = req.params.ssName;
    
    res.send(app.locals.mustache.render(
      'spreadsheet-update', 
      await getViewModel(ssName, app.locals.store)));
  }
}

/** Handler to handle the whole chunk of the project - setting up the data to send to mustache, 
* looping through and filling in the cell values corresponding to cellIds, handling validations of 
* entered input cellId and formula, empty input validations, retaining widget values on errors 
*/

function doSubmitSSUpdatePage(app){
  return async function(req, res){
    const { ssName } = req.params;
    const trimmedBody = trimValues(req.body);
    const { ssAct, cellId, formula } = trimmedBody; 
    
    const view = {};
    
    
    const errors = {};
    const validated = validateUpdate(trimmedBody, errors);
    if (!validated) {
        view.body = req.body;
        view.body.actions = {}
        // handling radio button data retrieval
        ACTS.forEach(e => {
          view.body.actions[e] = ssAct === e ? 'checked=checked' : '';
        })
        view.errors = errors;
    } else {
      try{
        // calling spreadsheet methods on spreadsheet instance
        const spreadsheet = await Spreadsheet.make(ssName, app.locals.store);
        switch (ssAct) {
          case 'clear':{
            await spreadsheet.clear();
            break;
          }
          case 'deleteCell':{
            await spreadsheet.delete(cellId);
            break;
          }
          case 'copyCell': {
            await spreadsheet.copy(cellId, formula);  
            break;
          }
          case 'updateCell':{
            await spreadsheet.eval(cellId, formula);
            break;
          }
          default:
            break;
        }
      } catch(e) {
        if(e instanceof AppError && (e.code == 'SYNTAX' || e.code == 'SYNTAX')){
          //catching and reporting AppErrors as formula errors
          view.errors = {};
          view.errors.formula = e.toString();

        }
      }
    }
    const viewModel = await getViewModel(ssName, app.locals.store);
    const rendered = app.locals.mustache.render(
      'spreadsheet-update',
      {...view, ...viewModel}
    );
    res.send(rendered);
  }
}
/** Default handler for when there is no route for a particular method
 *  and path.
 */
function do404(app) {
  return async function(req, res) {
    const message = `${req.method} not supported for ${req.originalUrl}`;
    res.status(NOT_FOUND).
      send(app.locals.mustache.render('errors',
				      { errors: [{ msg: message, }] }));
  };
}

/** Ensures a server error results in an error page sent back to
 *  client with details logged on console.
 */ 
function doErrors(app) {
  return async function(err, req, res, next) {
    res.status(SERVER_ERROR);
    res.send(app.locals.mustache.render('errors',
					{ errors: [ {msg: err.message, }] }));
    console.error(err);
  };
}

/************************* SS View Generation **************************/

const MIN_ROWS = 10;
const MIN_COLS = 10;

//Functions to build a spreadsheet view suitable for mustache

//Get max of row and column counts to display on page

function getCounts(dump){
  let rowCount = 0;
  let columnCount = 0; 
  dump.forEach(element => {
    const currColumnCount = element[0].charCodeAt(0) - 97;
    if(columnCount < currColumnCount){
      columnCount = currColumnCount;
    }
    const currRowCount = parseInt(element[0].slice(1), 10); 
    if(rowCount < currRowCount){
      rowCount = currRowCount;
    }

  });

  
  return [Math.max(rowCount, MIN_ROWS), Math.max(columnCount + 1, MIN_COLS)];
}

//the view-model of spreadsheet dump

function getSpreadsheetCells(spreadsheet, ssName){
  const dump = spreadsheet.dump();
  
  const cellMap = {};
  dump.forEach(d => cellMap[d[0].toUpperCase()] = true);
  
  const [rowCount, columnCount] = getCounts(dump);
  const columns = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").slice(0, columnCount);
  const view = [
    [ssName, ...columns]
  ];
  for (let i = 1; i <= rowCount; i++) {
    view[i] = {rowNum : i, values : []};
    for (let j = 0; j < columnCount; j++) {
      const cellId = `${columns[j]}${i}`;
      if (cellMap[cellId]) {
        
        const {value} = spreadsheet.query(cellId);
        view[i].values.push(value);
      } else {
        view[i].values.push("");
      }
    }
  }

  return {
    header : view[0],
    cells : view.slice(1)
  };  

}

/**************************** Validation ********************************/


const ACTS = new Set(['clear', 'deleteCell', 'updateCell', 'copyCell']);
const ACTS_ERROR = `Action must be one of ${Array.from(ACTS).join(', ')}.`;

//mapping from widget names to info.
const FIELD_INFOS = {
  ssAct: {
    friendlyName: 'Action',
    err: val => !ACTS.has(val) && ACTS_ERROR,
  },
  ssName: {
    friendlyName: 'Spreadsheet Name',
    err: val => !/^[\w\- ]+$/.test(val) && `
      Bad spreadsheet name "${val}": must contain only alphanumeric
      characters, underscore, hyphen or space.
    `,
  },
  cellId: {
    friendlyName: 'Cell ID',
    err: val => !/^[a-z]\d\d?$/i.test(val) && `
      Bad cell id "${val}": must consist of a letter followed by one
      or two digits.
    `,
  },
  formula: {
    friendlyName: 'cell formula',
  },
};

/** return true iff params[name] is valid; if not, add suitable error
 *  message as errors[name].
 */

function validateField(name, params, errors) {
  const info = FIELD_INFOS[name];
  const value = params[name];
  if (isEmpty(value)) {
    errors[name] = `The ${info.friendlyName} field must be specified`;
    return false;
  }
  if (info.err) {
    const err = info.err(value);
    if (err) {
      errors[name] = err;
      return false;
    }
  }
  return true;
}

  
/** validate widgets in update object, returning true iff all valid.
 *  Add suitable error messages to errors object.
 */
function validateUpdate(update, errors) {
  const act = update.ssAct ?? '';
  switch (act) {
    case '':
      errors.ssAct = 'Action must be specified.';
      return false;
    case 'clear':
      return validateFields('Clear', [], ['cellId', 'formula'], update, errors);
    case 'deleteCell':
      return validateFields('Delete Cell', ['cellId'], ['formula'],
			    update, errors);
    case 'copyCell': {
      const isOk = validateFields('Copy Cell', ['cellId','formula'], [],
				  update, errors);
      if (!isOk) {
	return false;
      }
      else if (!FIELD_INFOS.cellId.err(update.formula)) {
	  return true;
      }
      else {
	errors.formula = `Copy requires formula to specify a cell ID`;
	return false;
      }
    }
    case 'updateCell':
      return validateFields('Update Cell', ['cellId','formula'], [],
			    update, errors);
    default:
      errors.ssAct = `Invalid action "${act}`;
      return false;
  }
}

function validateFields(act, required, forbidden, params, errors) {
  for (const name of forbidden) {
    if (params[name]) {
      errors[name] = `
	${FIELD_INFOS[name].friendlyName} must not be specified
        for ${act} action
      `;
    }
  }
  for (const name of required) validateField(name, params, errors);
  return Object.keys(errors).length === 0;
}


/************************ General Utilities ****************************/

/** return new object just like paramsObj except that all values are
 *  trim()'d.
 */
function trimValues(paramsObj) {
  const trimmedPairs = Object.entries(paramsObj).
    map(([k, v]) => [k, v.toString().trim()]);
  return Object.fromEntries(trimmedPairs);
}

function isEmpty(v) {
  return (v === undefined) || v === null ||
    (typeof v === 'string' && v.trim().length === 0);
}

/** Return original URL for req.  If index specified, then set it as
 *  _index query param 
 */
function requestUrl(req, index) {
  const port = req.app.locals.port;
  let url = `${req.protocol}://${req.hostname}:${port}${req.originalUrl}`;
  if (index !== undefined) {
    if (url.match(/_index=\d+/)) {
      url = url.replace(/_index=\d+/, `_index=${index}`);
    }
    else {
      url += url.indexOf('?') < 0 ? '?' : '&';
      url += `_index=${index}`;
    }
  }
  return url;
}

//helper function to extract header row, cells and ssName to make it easier for rendering and other
//computations
async function getViewModel(ssName, store){
  const spreadsheet = await Spreadsheet.make(ssName, store);  
  const {header, cells} = getSpreadsheetCells(spreadsheet, ssName);
  return {header, cells, ssName};
}


