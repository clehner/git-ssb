# git-ssb

Git repos on [secure-scuttlebutt (SSB)][ssb].

This package includes:

- A command line tool `git-ssb` for managing SSB git repos
- A git remote helper [`git-remote-ssb`][] for using `ssb://` URLs with git
- A web server [`git-ssb-web`][] for browsing repos locally

## Install

```
npm install -g git-ssb
```

## Usage

You can use a `ssb://` remote like any other git remote. A repo on SSB is
identified by a message ID. To create a new git repo on SSB, use the command
`git ssb create`. You can only push to SSB git repos that you created, not ones
created by other users.

## Examples

Publish an existing repo to SSB:

    cd repo
    git ssb create
    git push ssb

Clone a repo from SSB:

    git clone ssb://<msgId> repo

Run the web server for browsing repos:

    git ssb web

## Configuration

As with [patchwork][], `git-ssb` reads the `ssb_appname` environment
variable when deciding what scuttlebot instance to connect to.
`git-ssb` also uses [git's config][git config] to get the appname if the
environment variable is not set. To make it so a repo only gets used in your
[testing environment][patchwork-testing], you can configure the repo as
follows:

    git config ssb.app_name test

[ssb]: https://github.com/ssbc/secure-scuttlebutt
[git config]: http://git-scm.com/docs/git-config
[patchwork]: https://github.com/ssbc/patchwork
[patchwork-testing]: https://github.com/ssbc/patchwork/blob/3f6d2d60b66361c3c926ff0a9e81847e71c8cfdd/docs/TESTING.md
[`git-ssb-web`]: https://github.com/clehner/git-ssb-web
[`git-remote-ssb`]: https://github.com/clehner/git-remote-ssb

## License

Copyright (c) 2016 Charles Lehner

Usage of the works is permitted provided that this instrument is
retained with the works, so that any entity that uses the works is
notified of this instrument.

DISCLAIMER: THE WORKS ARE WITHOUT WARRANTY.
