# Servish

A simple webserver for serving a single folder.

Written for Node.js to help with my web development.

Should manage to serve files, but nothing fancy.

## Install

`npm install -g servish`

## Usage

In the folder you wish to serve and use `servish` and it will be served.

### Rewrite / and all 404 to index.html

For developing frontend apps it is sometimes wanted to have all urls be handled
by our index.html document (Angular in HTML5 mode as an example).

To do this use the command line argument `--rewrite`.

`servish --rewrite` and it will rewrite all 404 to your index.html.
