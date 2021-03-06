require('dotenv').config();
const bodyParser = require('body-parser');
const express = require('express');
const Octokit = require('@octokit/rest');
const nacl = require('tweetnacl');
nacl.util = require('tweetnacl-util');

const username = 'yourusername';  // TODO: your GitHub username here
const github = new Octokit({ debug: true });
const server = express();
const port = process.env.PORT || 3000;

server.use(bodyParser.json());
// console.log(process.env.GITHUB_TOKEN);
// Generate an access token: https://github.com/settings/tokens
// Set it to be able to create gists
github.authenticate({
  type: 'oauth',
  token: process.env.GITHUB_TOKEN
});

// Set up the encryption - use process.env.SECRET_KEY if it exists
// TODO either use or generate a new 32 byte key
const key = process.env.SECRET_KEY ?
      nacl.util.decodeBase64(process.env.SECRET_KEY) : nacl.randomBytes(32);
server.get('/', (req, res) => {
  // TODO Return a response that documents the other routes/operations available
  res.send("Hello");
});

server.get('/gists', async (req, res) => {
  // TODO Retrieve a list of all gists for the currently authed user
  try  {
    const result = await github.gists.getForUser({username:'jaspindersingh83'})
    res.json(result.data)
  } catch(err){
    res.send(400).json({message:err})
  }
});

server.get('/key', async (req, res) => {
  // TODO Return the secret key used for encryption of secret gists
  res.send(nacl.util.encodeBase64(key));
});

server.get('/secretgist/:id', (req, res) => {
  // TODO Retrieve and decrypt the secret gist corresponding to the given ID
    const id = req.params.id;
    github.gists.get({ id }).then((response) => {
    const gist = response.data;
    const filename = Object.keys(gist.files)[0];
    const blob = gist.files[filename].content;
    // Assume nonce is first 24 bytes of blob, split and decrypt remainder
    // N.B. 24 byte nonce == 32 characters encoded in Base64
    const nonce = nacl.util.decodeBase64(blob.slice(0, 32));
    const ciphertext = nacl.util.decodeBase64(blob.slice(32, blob.length));
    const plaintext = nacl.secretbox.open(ciphertext, nonce, key);
    res.send(nacl.util.encodeUTF8(plaintext));
  });
});

server.post('/create', async (req, res) => {
  // TODO Create a private gist with name and content given in post request
  const {name, content} = req.body;
  const files = { [name]: { content } };
  const public = false;
  try{
    const result = await github.gists.create({files, public})
    res.send({sucess: true})
  } catch(err){
    res.send(err)
  }
});

server.post('/createsecret', (req, res) => {
  // TODO Create a private and encrypted gist with given name/content
  // NOTE - we're only encrypting the content, not the filename
  // To save, we need to keep both encrypted content and nonce
  const { name, content } = req.body;

  const nonce = nacl.randomBytes(24);
  const cipherText = nacl.secretbox(nacl.util.decodeUTF8(content), nonce, key);
  const myCipheredContent = nacl.util.encodeBase64(nonce) + nacl.util.encodeBase64(cipherText);
  
  const files = {
    [name]: { content: myCipheredContent },
  };
  const public = false;
  const options = { files, public };
  github.gists.create(options)
    .then(response => {
      res.json(response);
    })
    .catch(error => {
      res.json(error);
    });

});

/* OPTIONAL - if you want to extend functionality */
server.post('/login', (req, res) => {
  // TODO log in to GitHub, return success/failure response
  // This will replace hardcoded username from above
  // const { username, oauth_token } = req.body;
  res.json({ success: false });
});

/*
Still want to write code? Some possibilities:
-Pretty templates! More forms!
-Better management of gist IDs, use/display other gist fields
-Support editing/deleting existing gists
-Switch from symmetric to asymmetric crypto
-Exchange keys, encrypt messages for each other, share them
-Let the user pass in their private key via POST
*/

server.listen(port, () => {
  console.log(`The server is litening on ${port}`);
});
