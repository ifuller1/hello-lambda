"use strict"

let path = require('path');
let fs = require('fs');

const LAMBDAS_PATH = "./src/lambdas";

function createEntryPoints()
{
  let entryPointsArray = fs.readdirSync(path.join(__dirname, LAMBDAS_PATH))
      .map(filename =>
      {
        return {
          [filename.replace(".js", "")]: path.join(__dirname, LAMBDAS_PATH, filename)
        };
      });

  return entryPointsArray.reduce((returnObject, entryItem) =>
  {
    return Object.assign(returnObject, entryItem);
  }, {});
}

module.exports = {
  entry:createEntryPoints(),
  output: {
    path: path.join(__dirname, "dist"),
    library: "[name]",
    libraryTarget: "commonjs2",
    filename: "[name].js"
  },
  target: "node",
  module: {
    noParse: [/no\-parse/],
    loaders: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel',
        query: {
          presets: ['es2015'],
        }
      }
    ]
  }
};