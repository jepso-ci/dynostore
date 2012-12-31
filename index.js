var debug = require('debug')('dynostore');
var aws = require('aws-sdk');
var def = require('promises-a');
function fix(request) {
  request.send();
  var resolver = def();
  request.done(resolver.fulfill)
         .fail(resolver.reject);

  return resolver.promise.then(
    function (res) {
      return res.data;
    }, function (err) {
    if (err && err.error) {
      var e = new Error(err.error.message);
      e.name = 'AWS:' + err.error.code;
      e.retryable = err.retryable;
      e.request = err;
      throw e;
    } else {
      throw err;
    }
  });
}

var key = process.env.DYNOSTORE_KEY;
var secret = process.env.DYNOSTORE_SECRET;
aws.config.update({accessKeyId: key, secretAccessKey: secret});
aws.config.update({region: 'us-east-1'});

var db = new aws.DynamoDB({sslEnabled: true}).client;
exports.createTables = createTables;
function createTables() {
  function createTable(name, keys, provisioning) {
    return fix(db.createTable({
      TableName: name,
      KeySchema: {
        HashKeyElement: { AttributeName: keys.hash.name, AttributeType: keys.hash.type},
        RangeKeyElement: { AttributeName: keys.range.name, AttributeType: keys.range.type}
      },
      ProvisionedThroughput: {
        ReadCapacityUnits: provisioning.read,
        WriteCapacityUnits: provisioning.write
      }
    }))
    .then(null, function (err) {
      //ignore if table already exists
      //requires care when changing schema
      if (err.name === 'AWS:ResourceInUseException') return;
      throw err;
    });
  }
  var reposTable = createTable('repositories',
    {
      hash: {name: 'user', type: 'S'},
      range: {name: 'repo', type: 'S'}
    },
    {
      read: 2,
      write: 1
    });
  var buildsTable = createTable('builds',
    {
      hash: {name: 'repoID', type: 'S'},
      range: {name: 'buildID', type: 'N'}
    },
    {
      read: 8,
      write: 4
    });
  return reposTable.then(function () { return buildsTable; }).then(function(){});
}

function listRepos(user) {
  
}
exports.getRepo = getRepo;
function getRepo(user, repo) {
  return fix(db.getItem({
    TableName: 'repositories',
    Key: {
      HashKeyElement: { S: user },
      RangeKeyElement: { S: repo }
    }
  })).then(function (data) {
    return {
      user: data.Item.user.S,
      repo: data.Item.repo.S,
      currentBuild: data.Item.currentBuild ? data.Item.currentBuild.N : null,
      latestBuild: data.Item.latestBuild ? data.Item.latestBuild.N : null
    }
  });
}
exports.setRepoBuildComplete = setRepoBuildComplete;
function setRepoBuildComplete(user, repo, build) {
  return fix(db.updateItem({
    TableName: 'repositories',
    Key: {
      HashKeyElement: { S: user },
      RangeKeyElement: { S: repo }
     },
    AttributeUpdates: {
      latestBuild: { Value: {S: build},  }
    }
  }));
}
function listBuilds(user, repo) {

}
exports.getBuild = getBuild;
function getBuild(user, repo, buildID) {
  return fix(db.getItem({
    TableName: 'builds',
    Key: {
      HashKeyElement: { S: user + '/' + repo },
      RangeKeyElement: { N: '' + buildID }
    }
  })).then(function (data) {
    data = data.Item;
    var res = {};
    Object.keys(data)
      .forEach(function (key) {
        if (typeof data[key] === 'object') {
          if(typeof data[key].S === 'string') {
            res[key] = data[key].S;
          } else if (key === 'buildID' || key === 'pending') {
            res[key] = +data[key].N;
          } else if (typeof data[key].N === 'string') {
            res[key] = data[key].N === '1' ? true : (data[key].N === '0' ? false : data[key].N);
          }
        }
      });
    return res;
  });
}
exports.createBuild = createBuild;
function createBuild(user, repo, tag, browsers) {
  return fix(db.updateItem({
    TableName: 'repositories',
    Key: {
      HashKeyElement: { S: user },
      RangeKeyElement: { S: repo }
     },
    AttributeUpdates: {
      currentBuild: { Value: {N: '1'}, Action: 'ADD' }
    },
    ReturnValues: 'UPDATED_NEW'
  }))
    .then(function (res) {
      var buildID = res.Attributes.currentBuild.N;
      var item = {
          repoID: {S: user + '/' + repo},
          buildID: {N: buildID},
          tag: {S: tag},
          pending: {N: '' + browsers.length}
        };
      for (var i = 0; i < browsers.length; i++) {
        item[browsers[i]] = {S: 'queued'}
        item[browsers[i] + '-pending'] = {N: '1'};
      }
      return fix(db.putItem({
        TableName: 'builds',
        Item: item
      }))
      .then(function () {
        return buildID;
      });
    });
}
exports.updateBuild = updateBuild;
function updateBuild(user, repo, buildID, browser, status, finished) {
  var expected = {};
  expected[browser + '-pending'] = {Value: {N: '1'}};
  var update = {};
  update[browser] = {Value: {S: status}};
  if (finished) {
    update[browser + '-pending'] = {Value: {N: '0'}};
    update.pending = {Value: {N: '-1'}, Action: 'ADD'};
  }
  return fix(db.updateItem({
      TableName: 'builds',
      Key: {
        HashKeyElement: {S: user + '/' + repo},
        RangeKeyElement: {N: buildID}
      },
      AttributeUpdates: update,
      Expected: expected,
      ReturnValues: 'ALL_NEW'
    }))
    .then(function (res) {
      return +res.Attributes.pending.N;
    }, function (err) {
      finished = err.name === 'AWS:ConditionalCheckFailedException';
      if (err.name != 'AWS:ConditionalCheckFailedException')
        throw err;
      else
        return getBuild(user, repo, buildID)
          .then(function (res) {
            return res.pending;
          });
    })
    .then(function (pending) {
      if (pending === 0) {
        return completeBuild(user, repo, buildID);
      }
    })
    .then(function () {
      return finished;
    });
}
var fail = false;
function completeBuild(user, repo, buildID) {
  if (fail) return;
  return fix(db.updateItem({
      TableName: 'repositories',
      Key: {
        HashKeyElement: { S: user },
        RangeKeyElement: { S: repo }
      },
      Expected: {
        currentBuild: {Value: {N: '' + buildID}}
      },
      AttributeUpdates: {
        latestBuild: {Value: {N: '' + buildID} }
      }
    }))
    .then(function(){}, function (err) {
      if (err.name != 'AWS:ConditionalCheckFailedException')
        throw err;
    });
}
var s3 = new aws.S3();
//read from S3
function getBuildReport(user, repo, tag, browser) {

}
function saveBuildReport(user, repo, tag, browser) {

}