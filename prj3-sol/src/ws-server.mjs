import assert from 'assert';
import cors from 'cors';
import express from 'express';
import bodyParser from 'body-parser';

import {AppError} from 'cs544-ss';

/** Storage web service for spreadsheets.  Will report DB errors but
 *  will not make any attempt to report spreadsheet errors like bad
 *  formula syntax or circular references (it is assumed that a higher
 *  layer takes care of checking for this and the inputs to this
 *  service have already been validated).
 */

//some common HTTP status codes; not all codes may be necessary
const OK = 200;
const CREATED = 201;
const NO_CONTENT = 204;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const CONFLICT = 409;
const SERVER_ERROR = 500;

export default function serve(port, ssStore) {
  const app = express();
  app.locals.port = port;
  app.locals.ssStore = ssStore;
  setupRoutes(app);
  app.listen(port, function() {
    console.log(`listening on port ${port}`);
  });
}

const CORS_OPTIONS = {
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  preflightContinue: false,
  optionsSuccessStatus: 204,
  exposedHeaders: 'Location',
};

const BASE = 'api';
const STORE = 'store';

//function to handle bad request errors with different messages for spreadsheet req body
function sendBadReqError(res, message){
  
  const error = {
        "error" : {
          "code" : "BAD_REQUEST",
          "message" : message,
        },
        "status" : BAD_REQUEST
      }
      res.status(BAD_REQUEST).json(error);
}

//middleware to handle spreadsheet data validation for update & replace functionalities
//throws error if request body is null and req body is not an array of arrays with each inner 
//array element being a pair

function validateSpreadSheetBody(req, res, next){
    const spreadSheetName = req.params['spreadSheetName'];
    const bodyContent = req.body;
    const message = "request body must be a list of cellId, formula pairs"
    if(!Array.isArray(bodyContent) || !bodyContent){
     return sendBadReqError(res, message); 
    } 
    const isValid = (pair) => Array.isArray(pair) && pair.length === 2;
    if(!bodyContent.every(isValid)){
      return sendBadReqError(res, message);
    }
    next();
}

//variation of the above middleware but for individual cells and validation that req body must
//be an object mapping "formula" with the formula to replace/update
function validateFormulaBody(req, res, next){
    const bodyContent = req.body;
    const badReqError = "request body must be a { formula } object";
    if(typeof bodyContent !== 'object' || !bodyContent){
      return sendBadReqError(res, badReqError);
    } 
    if(Object.keys(bodyContent).length !== 1 || !bodyContent['formula']){
      return sendBadReqError(res, badReqError);
    }
    next();
}

//setting up all routes for retrieve, update/replace spreadsheet, clear spreadsheet, update/
//replace formula tied to particular cell, delete cell, calling handlers for 404(default handler) 
//and 500(server error handler)

function setupRoutes(app) {
  app.use(cors(CORS_OPTIONS));
  app.use(bodyParser.json());

  app.get("/api/store/:spreadSheetName", doRetrieveSpreadSheet(app));
  app.put(
    "/api/store/:spreadSheetName",
    validateSpreadSheetBody,
    doUpdateOrReplaceSpreadSheet(app, true)
  );
  app.patch(
    "/api/store/:spreadSheetName",
    validateSpreadSheetBody,
    doUpdateOrReplaceSpreadSheet(app, false)
  );
  app.delete("/api/store/:spreadSheetName", doClearSpreadSheet(app));
  app.put(
    "/api/store/:spreadSheetName/:cellId",
    validateFormulaBody,
    doUpdateOrReplaceCell(app, true)
  );
  app.patch(
    "/api/store/:spreadSheetName/:cellId",
    validateFormulaBody,
    doUpdateOrReplaceCell(app, false)
  );
  app.delete("/api/store/:spreadSheetName/:cellId", doDeleteCell(app));
  app.use(do404(app));
  app.use(doErrors(app));
}


/****************************** Handlers *******************************/

//handler for retrieve spreadsheet data, calling readFormulas on DBSSStore instance
function doRetrieveSpreadSheet(app){
  return async function(req, res, next){
    try{
      const {spreadSheetName} = req.params;
      const spreadSheetRes = await app.locals.ssStore.readFormulas(spreadSheetName);
      res.json(spreadSheetRes);
      } catch(err) {
          next(err);
      }
  }
}

//handler for update/replace spreadsheet, updates or replaces based on value of replace flag
//sent from calling this handler during route setup
function doUpdateOrReplaceSpreadSheet(app, replace = false){
  const statusCode = replace? CREATED : NO_CONTENT;
  return async function(req, res, next){
    try{
      const {spreadSheetName} = req.params;
      const bodyContent = req.body;
      if(replace){
         await app.locals.ssStore.clear(spreadSheetName);
      }
     
      for(const pair of bodyContent){
        const [cellId, formula] = pair;
        await app.locals.ssStore.updateCell(spreadSheetName, cellId, formula);
      }
      res.status(statusCode).send();
    } catch(err){
        next(err);
    }
  }

}

//handler to clear spreadsheet
function doClearSpreadSheet(app){
  return async function(req, res, next){
    try{
      const {spreadSheetName} = req.params;
      await app.locals.ssStore.clear(spreadSheetName);
      res.status(NO_CONTENT).send();
    } catch(err){
        next(err);
    }
  }
}

//handler to update/replace spreadsheet cell formulas and either updates/replace based on replace 
//flag
function doUpdateOrReplaceCell(app, replace = false){
  const statusCode = replace? CREATED : NO_CONTENT;
  return async function(req, res, next){
    try{
      const {spreadSheetName, cellId} = req.params;
      const {formula} = req.body;
      
      if(replace){
        await app.locals.ssStore.delete(spreadSheetName, cellId);
      }
      await app.locals.ssStore.updateCell(spreadSheetName, cellId, formula);
      res.status(statusCode).send();
    } catch(err){
        next(err);
    }
  } 
}

//handler to delete spreadsheet cell based on what is passed in the route
function doDeleteCell(app){
  return async function(req, res, next){
    try{
      const {spreadSheetName, cellId} = req.params;
      await app.locals.ssStore.delete(spreadSheetName, cellId);
      res.status(NO_CONTENT).send();
    } catch(err) {
        next(err);
    }
  }  
}

/** Default handler for when there is no route for a particular method
 *  and path.
 */
function do404(app) {
  return async function(req, res) {
    const message = `${req.method} not supported for ${req.originalUrl}`;
    const result = {
      status: NOT_FOUND,
      error: { code: 'NOT_FOUND', message, },
    };
    res.status(404).
	json(result);
  };
}


/** Ensures a server error results in nice JSON sent back to client
 *  with details logged on console.
 */ 
function doErrors(app) {
  return async function(err, req, res, next) {
    const result = {
      status: SERVER_ERROR,
      error: { code: 'SERVER_ERROR', message: err.message },
    };
    res.status(SERVER_ERROR).json(result);
    console.error(err);
  };
}


/*************************** Mapping Errors ****************************/

const ERROR_MAP = {
}

/** Map domain/internal errors into suitable HTTP errors.  Return'd
 *  object will have a "status" property corresponding to HTTP status
 *  code and an error property containing an object with with code and
 *  message properties.
 */
function mapError(err) {
  const isDomainError = (err instanceof AppError);
  const status =
    isDomainError ? (ERROR_MAP[err.code] || BAD_REQUEST) : SERVER_ERROR;
  const error = 
	isDomainError
	? { code: err.code, message: err.message } 
        : { code: 'SERVER_ERROR', message: err.toString() };
  if (!isDomainError) console.error(err);
  return { status, error };
} 

/****************************** Utilities ******************************/



/** Return original URL for req */
function requestUrl(req) {
  const port = req.app.locals.port;
  return `${req.protocol}://${req.hostname}:${port}${req.originalUrl}`;
}
