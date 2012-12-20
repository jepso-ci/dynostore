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
function getBuild(user, repo, buildID) {
  return fix(db.getItem({
    TableName: 'builds',
    Key: {
      HashKeyElement: { S: user + '/' + repo },
      RangeKeyElement: { S: buildID }
    }
  })).then(function (data) {
    var res = {};
    Object.keys(data)
      .forEach(function (key) {
        if (typeof data[key] === 'object' && typeof data[key].S === 'string') {
          res[key] = data[key].S;
        }
      });
  });
}
function createBuild(user, repo, buildID, browsers) {
  var item = {
      repoID: {S: user + '/' + repo},
      buildID: {S: buildID},
      state: {S: 'pending'}
    };
  for (var i = 0; i < browsers.length; i++) {
    item[browsers[i]] = {S: 'queued'}
  }
  db.putItem({
    TableName: 'builds',
    Item: item
  });
}

var s3 = new aws.S3();
//read from S3
function getBuildReport(user, repo, buildID, browser) {

}