import { HmacSHA1, enc } from 'crypto-js';
import OAuth from 'oauth-1.0a'


export default {
	async scheduled(controller, env, ctx) {	
		console.log("Entering Scheduled", env)
		ctx.waitUntil(retrieveMetrics(env))
	},
};

async function retrieveMetrics(env){
	const TOKEN_OBJ = {key: env.TOKEN, secret: env.TOKEN_SECRET}
	const CONSUMER_OBJ = {key: env.CONSUMER_KEY, secret: env.CONSUMER_SECRET}
	const oauth = OAuth({consumer: CONSUMER_OBJ,signature_method: 'HMAC-SHA1',hash_function(base_string, key) {return HmacSHA1(base_string, key).toString(enc.Base64);}})
	const params = new URLSearchParams({"tweet.fields" : "organic_metrics","max_results": "100","since_id": env.SINCE_ID})
	const target_url = "https://api.twitter.com/2/users/" + env.USER_ID + "/tweets?" + params.toString()  
	const responseData = await fetch(target_url, {method: 'GET',headers: oauth.toHeader(oauth.authorize({url: target_url,method: 'GET'}, TOKEN_OBJ, CONSUMER_OBJ)),})
		.then(response => response.json())
		.catch(err => console.error(err));	
		for (let t of responseData.data){
			await logMetrics(t, env)
		}
		return new Promise((val) =>  true, (val) => false)
}

async function logMetrics(tweet, env) {
	console.log('logMetrics', tweet.id)
	let impression_time = new Date().getTime()
	let tweet_payload = JSON.stringify(tweet)
	let current = await env.TWITTER_METRICS_KV.get(tweet.id, {type: 'json'})
	if (current === null){
		console.log("New tweet", tweet.id)
		current = tweet;
		current.organic_metrics = blankMetrics()
	}

	if (objectsAreDifferent(tweet, current)){
		let new_views = tweet.organic_metrics.impression_count - current.organic_metrics.impression_count
		if (new_views > 0){
			console.log("Recording new views", tweet.id)
			 await env.TWITTER_VIEWS_KV.put(`${impression_time}.${tweet.id}`, new_views)
		}
		console.log("Saving new metrics", tweet.id)
		let myResp = await env.TWITTER_METRICS_KV.put(tweet.id, tweet_payload)
	} else {
		console.log("Objects Match", current)
	}
	return true
}

function objectsAreDifferent(one, two){
	return JSON.stringify(one) === JSON.stringify(two)
}

function blankMetrics(){
	return {
		"impression_count": 0,
		"like_count": 0,
		"reply_count": 0,
		"user_profile_clicks": 0,
		"retweet_count": 0
	}
}