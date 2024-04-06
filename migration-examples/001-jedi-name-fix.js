const fs = require('fs');
const path = require('path');
const uuid = require('uuid');

exports.databaseName = 'StarWars';
exports.containerName = 'jedi';
exports.run = async function (database, container) {
  console.log('Modifying ref data enactment');

  // You could load external JSON
  const jsonData = fs.readFileSync(__dirname + '/001-jedi-name-fix.json', {
    encoding: 'utf8',
  });
  const document = JSON.parse(jsonData);
  const item = container.item(document.id, undefined);
  console.log("Read item '" + item.id + "'");
  const { resource: readDoc } = await item.read();
  console.log("item with id '" + readDoc.id + "' found");

  // Update the document
  await item.replace(document);
  console.log("item with id '" + item.id + "' replaced");

  console.log('done');
};
