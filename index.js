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
  var reposTable = fix(db.createTable({
    TableName: 'repositories',
    KeySchema: {
      HashKeyElement: { AttributeName: 'user', AttributeType: 'S'},
      RangeKeyElement: { AttributeName: 'repo', AttributeType: 'S'},
    },
    ProvisionedThroughput: {
      ReadCapacityUnits: 2,
      WriteCapacityUnits: 1
    }
  }));
  var buildsTable = fix(db.createTable({
    TableName: 'builds',
    KeySchema: {
      HashKeyElement: { AttributeName: 'repoID', AttributeType: 'S'},
      RangeKeyElement: { AttributeName: 'buildID', AttributeType: 'S'},
    },
    ProvisionedThroughput: {
      ReadCapacityUnits: 8,
      WriteCapacityUnits: 4
    }
  }));
  reposTable.then(function () { return buildsTable; });
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
      currentBuildInProgress: data.Item.currentBuildInProgress ? data.Item.currentBuildInProgress.S : null,
      latestBuild: data.Item.latestBuild ? data.Item.latestBuild.S : null
    }
  });
}
exports.setRepoBuildInProgress = setRepoBuildInProgress;
function setRepoBuildInProgress(user, repo, build) {
  return fix(db.updateItem({
    TableName: 'repositories',
    Key: {
      HashKeyElement: { S: user },
      RangeKeyElement: { S: repo }
     },
    AttributeUpdates: {
      currentBuildInProgress: { Value: {S: build},  }
    }
  }));
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
function getBuild(user, repo, tag) {
  return fix(db.getItem({
    TableName: 'builds',
    Key: {
      HashKeyElement: { S: user + '/' + repo },
      RangeKeyElement: { S: tag }
    }
  })).then(function (data) {
    var res = {};
    Object.keys(data)
      .forEach(function (key) {
        if (typeof data[key] === 'object' && typeof data[key].S === 'string') {
          res[key] = data[key].S;
        }
      });
    return res;
  });
}
exports.createBuild = createBuild;
function createBuild(user, repo, tag, browsers) {
  var item = {
      repoID: {S: user + '/' + repo},
      buildID: {S: tag},
      state: {S: 'pending'}
    };
  for (var i = 0; i < browsers.length; i++) {
    item[browsers[i]] = {S: 'queued'}
  }
  return fix(db.putItem({
    TableName: 'builds',
    Item: item
  }));
}
exports.updateBuild = updateBuild;
function updateBuild(user, repo, tag, browser, status) {
  var update = {};
  update[browser] = {Value: {S: status}};
  return fix(db.updateItem({
    TableName: 'builds',
    Key: {
      HashKeyElement: {S: user + '/' + repo},
      RangeKeyElement: {S: tag}
    },
    AttributeUpdates: update
  }));
}

var s3 = new aws.S3();
//read from S3
function getBuildReport(user, repo, tag, browser) {

}
function saveBuildReport(user, repo, tag, browser) {

}