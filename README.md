# dynostore

  Dynamo db wrapper for the jepso-ci schema

## Sample Usage

```javascript
var u = 'api';
var r = 'foo';
var t = 'master';
createBuild(u, r, t, ['BrowserA', 'BrowserB'])
  .then(function (buildID) {
    console.log('buildID=' + buildID);
    function logStatus(v) {
      return getRepo(u, r)
        .then(log)
        .then(function () {
          return getBuild(u, r, buildID);
        })
        .then(log)
        .then(function () {
          return v;
        });
    }
    return logStatus()
      .then(function () {
        console.log("updateBuild(u, r, buildID, 'BrowserA', 'started', false)");
        return updateBuild(u, r, buildID, 'BrowserA', 'started', false);
      })
      .then(logStatus)
      .then(function () {
        console.log("updateBuild(u, r, buildID, 'BrowserB', 'started', false)");
        return updateBuild(u, r, buildID, 'BrowserB', 'started', false);
      })
      .then(logStatus)
      .then(function () {
        console.log("updateBuild(u, r, buildID, 'BrowserA', 'finished', true)");
        return updateBuild(u, r, buildID, 'BrowserA', 'finished', true);
      })
      .then(logStatus)
      .then(function () {
        console.log("updateBuild(u, r, buildID, 'BrowserB', 'finished', true)");
        return updateBuild(u, r, buildID, 'BrowserB', 'finished', true);
      })
      .then(logStatus)
  }).done()
function log(v) {
  console.log(v);
  return v;
}
```

Sample Output:

```
buildID=1
{ user: 'api',
  repo: 'foo',
  currentBuildInProgress: '1',
  latestBuild: null }
{ tag: 'master',
  repoID: 'api/foo',
  'BrowserA-pending': true,
  buildID: 1,
  pending: 2,
  BrowserA: 'queued',
  'BrowserB-pending': true,
  BrowserB: 'queued' }
updateBuild(u, r, buildID, 'BrowserA', 'started', false)
{ user: 'api',
  repo: 'foo',
  currentBuildInProgress: '1',
  latestBuild: null }
{ tag: 'master',
  repoID: 'api/foo',
  'BrowserA-pending': true,
  buildID: 1,
  pending: 2,
  BrowserA: 'started',
  'BrowserB-pending': true,
  BrowserB: 'queued' }
updateBuild(u, r, buildID, 'BrowserB', 'started', false)
{ user: 'api',
  repo: 'foo',
  currentBuildInProgress: '1',
  latestBuild: null }
{ tag: 'master',
  repoID: 'api/foo',
  'BrowserA-pending': true,
  buildID: 1,
  pending: 2,
  BrowserA: 'started',
  'BrowserB-pending': true,
  BrowserB: 'started' }
updateBuild(u, r, buildID, 'BrowserA', 'finished', true)
{ user: 'api',
  repo: 'foo',
  currentBuildInProgress: '1',
  latestBuild: null }
{ tag: 'master',
  repoID: 'api/foo',
  'BrowserA-pending': false,
  buildID: 1,
  pending: 1,
  BrowserA: 'finished',
  'BrowserB-pending': true,
  BrowserB: 'started' }
updateBuild(u, r, buildID, 'BrowserB', 'finished', true)
{ user: 'api',
  repo: 'foo',
  currentBuildInProgress: null,
  latestBuild: '1' }
{ tag: 'master',
  repoID: 'api/foo',
  'BrowserA-pending': false,
  buildID: 1,
  pending: 0,
  BrowserA: 'finished',
  'BrowserB-pending': false,
  BrowserB: 'finished' }
```