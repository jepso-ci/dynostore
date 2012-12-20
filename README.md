# dynostore

  Dynamo db wrapper for the jepso-ci schema

## Repositories

  id= {userID, repoID}
  attr= {latestBuild, currentBuildInProgress?}

## Builds

  id= {repoPath, hash}
  attr= {chrome, firefox ....}

  Each browser can be:

  {'pass', 'fail', 'fail-n.n.n', 'pending-n.n.n', 'queued'}