var babel = require("babel-core");
var recursive = require("recursive-readdir");
var async = require("async");
var fs = require("fs");

function parseFile(path, callback) {
  var options = {
    code: false,
    comments: false,
    highlightCode: false,
    metadata: false
  };
  babel.transformFile(path, options, function(error, result) {
    var bodies = result.ast.program.body;
    var preparedDatas = [];
    for (var i = 0; i < bodies.length; i++) {
      var body = bodies[i];
      var arguments = body.expression.arguments;
      var preparedData = {
        name: arguments[0].value,
        extend: null,
        use: []
      };

      var properties = arguments[1].properties;
      for (var i = 0; i < properties.length; i++) {
        var property = properties[i];
        var name = property.key.name;
        var value = property.value;
        var preparedValue = null;
        switch (value.type) {
          case "StringLiteral":
            preparedValue = value.value;
            break;
          case "ArrayExpression":
            preparedValue = [];
            for (var j = 0; j < value.elements.length; j++) {
              var element = value.elements[j];
              if (element.value) {
                preparedValue.push(element.value);
              }
            }
            break;
          case "ObjectExpression":
            preparedValue = [];
            for (var j = 0; j < value.properties.length; j++) {
              var property = value.properties[j];
              if (property.value.value) {
                preparedValue.push(property.value.value);
              }
            }
            break;
        }
        switch (name) {
          case "extend":
            preparedData.extend = preparedValue;
            break;
          case "mixins":
          case "uses":
          case "stores":
          case "views":
          case "requires":
            if (preparedValue && preparedValue.length) {
              preparedData.use = preparedData.use.concat(preparedValue);
            }
            break;
        }
      }
      preparedDatas.push(preparedData);
    }
    return callback(null, preparedDatas)
  });
}

function prepareTree(nodes) {
  function findNode(nodes, name) {
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].name === name) {
        return nodes[i];
      }
    }
    return null;
  }

  for (var i = 0; i < nodes.length; i++) {
    var node = findNode(nodes, nodes[i].extend);
    if (!node) {
      nodes.push({
        name: nodes[i].extend,
        extend: null,
        children: []
      });
    }
  }

  function unflatten(arr) {
    var tree = [],
      mappedArr = {},
      arrElem,
      mappedElem;

    for (var i = 0, len = arr.length; i < len; i++) {
      arrElem = arr[i];
      mappedArr[arrElem.name] = arrElem;
      mappedArr[arrElem.name]["children"] = [];
    }


    for (var name in mappedArr) {
      if (mappedArr.hasOwnProperty(name)) {
        mappedElem = mappedArr[name];
        if (mappedElem.extend) {
          mappedArr[mappedElem["extend"]]["children"].push(mappedElem);
        } else {
          tree.push(mappedElem);
        }
      }
    }
    return tree;
  }

  return {
    name: "root",
    children: unflatten(nodes)
  };
}

recursive("../Easylitics-2012/projects/Easylitics/web/elygui/", ["node_modules", "coverage", "all-classes.js", "app-all.js", "app.js", "vendor", "translations"], function(error, files) {
  if (error) {
    console.error(error);
    throw error;
  }
  files = files.filter(function(file) {
    return /.*\.js$/.test(file);
  });
  async.mapSeries(files, function(file, callback) {
    return parseFile(file, function(error, data) {
      return callback(error, data)
    });
  }, function(error, results) {
    results = results.map(function(result) {
      return result[0];
    }).filter(function(result) {
      return !!result;
    });

    fs.writeFile("report.json", JSON.stringify(prepareTree(results)), function(error) {
      if (error) {
        console.error(error);
      }
      console.log("json done");
    });
  });
});