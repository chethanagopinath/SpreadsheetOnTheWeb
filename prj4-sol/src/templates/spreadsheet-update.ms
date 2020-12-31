<!DOCTYPE html>
<html>
  <head>
    <title>CS 444/544 Spreadsheet Updata</title>
    <link rel="stylesheet" href="/style.css" type="text/css"/>
  </head>
  <body>
    <h1>CS 444/544 Spreadsheet Update for {{ssName}}</h1>
    <p><a id="ss-act" href="/">Open other spreadsheet</a></p>
    <table class="ss">
      <tr>
        {{#header}}<th>{{.}}</th>{{/header}}
      </tr>
      {{#cells}}<tr>
        <th>
          {{rowNum}}
        </th>
        {{#values}}
          <td>{{.}}</td>
        {{/values}}
      </tr>{{/cells}}
    </table>
    <p class="error"></p>
    <form action="/ss/{{ssName}}" method="POST">
      <label for="ssAct">Action</label>
      <span>
  <fieldset>
          <div>
      <input name="ssAct" type="radio" 
       id="actClear" value="clear" {{{body.actions.clear}}}>
      <label for="actClear">Clear Spreadsheet</label>
          </div>
          <div>
            <input name="ssAct" type="radio"  
       id="actDelete" value="deleteCell" {{{body.actions.deleteCell}}}>
      <label for="act">Delete Cell</label>
          </div>
          <div>
      <input name="ssAct" type="radio"  
       id="actUpdate" value="updateCell" {{{body.actions.updateCell}}}>
      <label for="actUpdate">Update Cell</label>
          </div>
        <div>
    <input name="ssAct" type="radio" 
     id="actCopy" value="copyCell" {{{body.actions.copyCell}}}>
    <label for="actCopy">Copy Cell</label>
        </div>
  </fieldset>
  <br/>
  <span class="error" id="ssActError">
    {{errors.ssAct}}
  </span>
      </span>
      <label for="cellId">Destination Cell ID</label>
      <span>
  <input name="cellId" value="{{body.cellId}}" id="cellId"/>
  <br/>
  <span class="error" id="cellIdError">
    {{errors.cellId}}
  </span>
  </span>
      <label for="formula">Formula</label>
      <span>
  <input name="formula" value="{{body.formula}}" id="formula"/>
  <br/>
  <span class="error" id="formulaError">
    {{errors.formula}}
  </span>
      </span>
      <label>&nbsp;</label>
      <input type="submit" value="Update"/>
    </form>
  </body>
</html>
