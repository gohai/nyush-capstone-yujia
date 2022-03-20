const body_parser = require('body-parser');
const cors = require('cors');
const express = require('express');
const fs = require('fs');

/**
 * This makes use of the Express web framework for Node.js
 * see https://expressjs.com/ for documentation
 */

const app = express();
app.use(cors());  // enable cross-origin requests
const json_parser = body_parser.json();
const port = process.env.PORT || 8080;

let posts = [];  // a flat array of post objects, same as in posts.json


app.get('/', async function(req, res) {
	res.send('OK');
});


/**
 * Get all posts (including replies)
 */
app.get('/posts', async function(req, res) {
	res.json(formatPosts());
});


/**
 * Add a new post or reply
 *
 * Expects a JSON-formatted post object as body.
 */
app.post('/post', json_parser, async function(req, res) {
	let post = req.body;                // get the post from the request body

	post.id = posts.length+1;           // each post gets an id
	post.parent = post.parent || null;  // if a post is a reply, parent is set
	post.username = post.username || 'Anonymous';
	post.text = post.text || '';
	post.created_at = Date.now();
	post.last_interaction = null;
	post.likes = [];                    // start with no likes
	delete post.replies;				// make sure we're never saving replies like this

	if (post.parent && post.parent <= posts.length) {
		posts[post.parent-1].last_interaction = Date.now();
	}

	posts.push(post);
	savePosts();

	res.json(formatPost(post));
});


/**
 * Like a post or reply
 * 
 * Expects a JSON-formatted object with keys "id" and "username".
 */
app.post('/like', json_parser, async function(req, res) {
	let like = req.body;                // get the like from the request body

	if (like.id && like.id <= posts.length) {
		if (!posts[like.id-1].likes.includes(like.username)) {
			posts[like.id-1].likes.push(like.username);
			posts[like.id-1].last_interaction = Date.now();
			savePosts();
		}
		res.json(formatPost(posts[like.id-1]));
	} else {
		res.sendStatus(404);
	}
});


app.listen(port, async function() {
	console.log('Web server listening at http://localhost:' + port);
});

loadPosts();


/**
 * Helper functions
 */

/**
 * Load posts.json and update the global posts array with its data
 */
async function loadPosts() {
	try {
		const data = fs.readFileSync('posts.json', 'utf8');
		let json = JSON.parse(data);
		if (!Array.isArray(json)) {
			throw 'posts.json is no array';
		}
		posts = json;
	} catch (e) {
		console.error('loadPosts', e);
	}
}

/**
 * Save the global posts array to posts.json
 */
async function savePosts() {
	try {
		const data = JSON.stringify(posts, null, '\t');
		fs.writeFileSync('posts.json', data);
	} catch (e) {
		console.error('savePosts', e);
	}
}

/**
 * Turn the global posts array into a hierarchical (nested) list, newest first
 * @return array
 */
function formatPosts() {
	let nested_posts = [];                            // nested list of post, newest first

	for (let i=posts.length-1; 0 <= i; i--) {         // get all posts
		if (posts[i].parent) {
			continue;                                 // skip replies
		}
		nested_posts.push(formatPost(posts[i]));      // turn the post into a nested form and add to the list
	}

	return nested_posts;                              // return the list
}

/**
 * Turn a post object into the hierarchical (nested) form, including replies
 * @return object
 */
function formatPost(post) {
	let nested_post = { ...post };                    // clone the post so that we can modify it without affecting the original
	nested_post.replies = [];                         // list of replies, newest first

	for (let i=posts.length-1; 0 <= i; i--) {         // get all posts
		if (posts[i].parent != nested_post.id) {
			continue;                                 // skip posts that aren't a reply
		}

		let nested_reply = { ... posts[i] };          // clone the reply
		nested_reply.replies = [];                    // replies can't have replies
		nested_post.replies.push(nested_reply);		  // add to the list of replies
	}

	return nested_post;
}
