//jshint esversion:10

//                         _________    ____________    ____   ____
//                        /    __   \ /            /  ./    | /    |
//                       /    /  )   '     _______/ ./      |/     |
//                      /    /__/         /       ./                |
//                     /                 (      ./                  |
//                    /     _             \____/    ,.      ,.      |
//                   /     / )     ,               / |     / |       |
//                  /_____/  ;____/ \_____________/  |____/  |_______|
//                 R E M O T E   C O N D I T I O N   M O N I T O R I N G
//                                                 Part of the DVR Group
//
//                  TITLE:          MMG2 Core API Class
//
//              AUTHOR(S):          Gary Ott (gary.ott@dvr-ltd.co.uk)
//
//                   DATE:          August 2022 ~ August 2023
//
//
//	(C) DVR Ltd 2023
//
//  Redistribution and use in source and binary forms, with or without
//  modification, are permitted provided that the following conditions
//  are met:
//
//    Redistributions of source code must retain the above copyright
//    notice, this list of conditions and the following disclaimer.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS 
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT 
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT 
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, 
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT 
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT 
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE 
//  OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

const
	https        = require("https"),
	EventEmitter = require("events"),

	WebSocket    = require("ws"),

	AUTH_ERROR   = "Authentication failure.",


	WS_STATE     = {
		CLOSED:       0,
		CLOSING:      1,
		OPEN:         2,
		OPENING:      3,
		RECONN:       4
	},

	CRUD_TYPES   = {
		CREATE:       1,
		READ:         2,
		UPDATE:       3,
		DELETE:       4
	},

	DATA_SETS    = {
		USERS:           1,
		USERGROUPS:      2,
		TEMPLATES:       8,
		SITE_ICONS:      9,
		SITES:           3,
		LOCATIONS:       4,
		BOM_ENTRIES:     5,
		STATUS:          6,
		REPORTS:         7,
		SCHEDULES:       8,
		DEPLOYABLE:      9,
		UNDEPLOYABLE:    10,
		ALARMS:          11,
		PREPAY_CODES:    12,
		CONTROL_HISTORY: 13
	},


	noop                        = () => {};


		
	//PRIVATE METHODS FOR JobQueue
	//============================

const
	JQ_beginJob = (pVars) => {

		///Starts a new job if possible.

		let

			getCompleteFunction     = (j) => {
				return () => {
					//Called by the job to notify JobQueue of completion.

					if (j.completed) {
						throw new Error("Job completed multiple times.");
					}

					j.completed = true;

					pVars.queue.splice(pVars.queue.indexOf(j), 1);
					
					pVars.activeJobs  -= 1;
					pVars.queueLength -= 1;
					pVars.completed   += 1;
					
					if ((pVars.queueLength === 0) && (pVars.activeJobs === 0)) {
						if (pVars.onCompleteQueue) {
							pVars.onCompleteQueue();
						}
					}
					else {
						JQ_beginJob(pVars);
					}
				};
			},

			getAbortFunction        = () => {
				return (about) => {
					if (!pVars.aborted) {
						pVars.aborted = true;
						if (pVars.onAbortQueue) {
							pVars.onAbortQueue(about);
						}
					}
				};
			},

			h_startWithoutCallStack = (job) => {
				return () => {
					job.run(job.context, getCompleteFunction(job), getAbortFunction());
				};
			};
		
		while (pVars.started && (!pVars.aborted) && (pVars.activeJobs < pVars.concurrentLimit) && (pVars.activeJobs < pVars.queueLength)) {
			setTimeout(h_startWithoutCallStack(pVars.queue[pVars.activeJobs]), 0);
			pVars.activeJobs += 1;
		}
	};


class JobQueue {
	constructor() {

		this._private = {
			activeJobs:      0,        //Number of jobs currently running.
			queueLength:     0,        //Current number of items in queue
			enqueued:        0,        //Number of jobs that have been added to the queue.
			completed:       0,        //Number of jobs that have been added to the queue.
				
			queue:           [],       //The list of jobs in the queue.
			aborted:         false,    //Current state
			started:         false,    //Current state
				
			//Settings
			concurrentLimit: 0,        //Maximum number of jobs that may run simutaniously.
			onCompleteQueue: 0,     //Called everytime the queue is completely empty.
			onAbortQueue:    0     //Called when a job aborts the whole queue.
		};
	}

	enqueue(job, context) {
		let pVars = this._private;

		pVars.queue.push({
			context:   context,
			run:       job,
			completed: false
		});
		
		pVars.enqueued    += 1;
		pVars.queueLength += 1;
		
		if (pVars.started) {
			//Cause job to start if within limits.
			JQ_beginJob(pVars);
		}
	}

	setLimit(newValue) {
		if ((newValue === undefined) || (newValue < 1) || (isNaN(newValue))) {
			throw new Error("JobQueue: Invalid value for limit.");
		}

		this._private.concurrentLimit = newValue;
	}

	start() {
		let pVars = this._private;
		
		if (pVars.started) {
			throw new Error("JobQueue: Cannot start a job queue that is already running.");
		}
		
		pVars.started = true;
		
		if (pVars.queueLength > 0) {
			JQ_beginJob(pVars);
		}
		else if (pVars.onCompleteQueue) {
			pVars.onCompleteQueue();
		}
	}

	// pause() {
	// 	this._private.started = false;
	// }

	// getStats() {
	// 	let pVars = this._private;
	// 	return {
	// 		activeJobs:    pVars.activeJobs,
	// 		enqueued:      pVars.enqueued,
	// 		limit:         pVars.concurrentLimit,
	// 		queueLength:   pVars.queueLength,
	// 		completedJobs: pVars.completed
	// 	};
	// }

	onAbort(newValue) {
		this._private.onAbortQueue = newValue;
	}

	onComplete(newValue) {
		this._private.onCompleteQueue = newValue;
	}
}


	//PRIVATE METHODS FOR MMG2CoreAPI
	//===============================
const
	COREcheckTimer              = (self) => {

		var timeNow      = Date.now(),
			a            = 0,
			runAgain     = false,
			request      = null,
			timeoutAfter = 0,
			nextTimeout  = timeNow + (24 * 60 * 60 * 1000);

		for (a = self.sentWebSocketRequests.length - 1; a >= 0; a -= 1) {
			request = self.sentWebSocketRequests[a];

			if ((request.context) && (request.context.timeout)) {
				timeoutAfter = request.context.timeout;
			}
			else {
				timeoutAfter = self.timeout;
			}
			
			if ((request.ts.getTime() + timeoutAfter) < timeNow) {
				self.sentWebSocketRequests.splice(a, 1);    //This line MUST go before the following or it is 
				                                       //possible that checkTimer is called again resulting
				                                       //in the same job being timed out multiple times and
				                                       //getting an error from request.complete()
				                                       //Bug fix, 30.11.2018, Gary

				if (request.context.onFailure) {
					request.context.onFailure(0);
				}

				request.complete();
			}
			else if (request.ts.getTime() + timeoutAfter < nextTimeout) {
				nextTimeout = (request.ts.getTime() + timeoutAfter);
				runAgain = true;
			}
		}

		if (self.timer) {
			clearTimeout(self.timer);
		}

		if (runAgain) {
			self.timer = setTimeout(COREcheckTimer, nextTimeout - timeNow, self);
		}
	},

	COREgetLDMConfig            = (dataSet, params) => {
		switch (dataSet) {
			case DATA_SETS.USERS:
				return {
					idField:           "userID",                           //Uniqueness of this field within the data
					                                                       //object is enforced. New data overwrites old
					                                                       //data.

					subscribeTopics:   ["SRV/users"],  
					                                                       //List of topics to subscribe to for new
					                                                       //messages from other users. 
					
					createAPI:         "/API/createUser",  //API to call to create a new entry. 
					readAPI:           "/API/getUsers",    //API to call to obtain initial data set.
					updateAPI:         "/API/updateUser",  //API to call to update an entry.

					readAPIArrayField: "users",
				};

			case DATA_SETS.USERGROUPS:
				return {
					idField:           "groupID",                          //Uniqueness of this field within the data
					                                                       //object is enforced. New data overwrites old
					                                                       //data.

					subscribeTopics:   ["SRV/usergroups"],  
					                                                       //List of topics to subscribe to for new
					                                                       //messages from other users. 
					
					createAPI:         "/API/createUserGroup",  //API to call to create a new entry. 
					readAPI:           "/API/getUserGroups",    //API to call to obtain initial data set.
					updateAPI:         "/API/updateUserGroup",  //API to call to update an entry.
					deleteAPI:         "/API/deleteUserGroup",  //API to call to delete an entry.

					readAPIArrayField: "groups"
				};

			case DATA_SETS.TEMPLATES:
				return {
					idField:           "templateID",                             //Uniqueness of this field within the data object is enforced. New data overwrites old data.
					subscribeTopics:   ["SRV/templates"],                      //List of topics to subscribe to for new messages from other users. 
					
					createAPI:         "/API/setup/createTemplate",     //API to call to create a new entry. 
					readAPI:           "/API/setup/getTemplates",      //API to call to obtain initial data set.
					updateAPI:         "/API/setup/updateTemplate",  	 //API to call to update an entry.
					deleteAPI:         "/API/setup/deleteTemplate",     //API to call to delete an entry.

					readAPIArrayField: "templates"
				};

			case DATA_SETS.SITE_ICONS:
				return {
					idField:           "siteIconID",                            //Uniqueness of this field within the data object is enforced. New data overwrites old data.
					subscribeTopics:   ["SRV/siteIcons/" + params.locationID],  //List of topics to subscribe to for new messages from other users. 
					readAPI:           "/API/setup/getSiteIcons",               //API to call to obtain initial data set.
					readAPIArrayField: "templates"                              // needs to match the returnAs in messageMap	
				};

			case DATA_SETS.SITES:
				return {
					subscribeTopics:   ["SRV/sites"],
					idField:           "locationID",
					readAPIArrayField: "sites",
					readAPI:           "/API/setup/getSites"
				};

			case DATA_SETS.REPORTS:
				return {
					idField:           "reportID",           				
					subscribeTopics:   ["SRV/report/" + $rootScope.site.locationID],
					readAPI:           "/API/report/getScheduledReports",
					deleteAPI:         "/API/report/deleteReport",
					readAPIArrayField: "report"
				};

			case DATA_SETS.SCHEDULES:
				return {
					idField:           "scheduleID",

					subscribeTopics:   ["SRV/schedule/" + params.locationID],
					createAPI:         "/API/schedule/createSchedule",  
					readAPI:           "/API/schedule/getScheduleList",    
					updateAPI:         "/API/schedule/updateSchedule",  
					deleteAPI:         "/API/schedule/deleteSchedule", 

					readAPIArrayField: "schedule",
				};

			case DATA_SETS.DEPLOYABLE:
				return {
					idField:           "undeployedID",
					subscribeTopics:   ["SRV/deployable/" + params.locationID],
					readAPI:           "/API/asset/getDeployable",
					readAPIArrayField: "deployable"
				};

			case DATA_SETS.UNDEPLOYABLE:
				return {
					idField:           "undeployedID",
					subscribeTopics:   ["SRV/undeployable/" + params.locationID],
					readAPI:           "/API/asset/getUndeployable",
					readAPIArrayField: "undeployable"
				};

			case DATA_SETS.ALARMS:
				return {
					idField:           "alarmID",                            //Uniqueness of this field within the data object is enforced. New data overwrites old data.
					subscribeTopics:   ["SRV/alarms/" + params.locationID],  //List of topics to subscribe to for new messages from other users. 
					readAPI:           "/API/monitor/getAlarms",             //API to call to obtain initial data set.
					readAPIArrayField: "alarms",                             // needs to match the returnAs in messageMap
				};

			case DATA_SETS.LOCATIONS:
				return {
					subscribeTopics:   ["SRV/locations/" + params.locationID],
					
					idField:           "locationID",
					readAPIArrayField: "locations",

					createAPI:         "/API/setup/createLocation",
					readAPI:           "/API/setup/getLocations",
					updateAPI:         "/API/setup/updateLocation",
					deleteAPI:         "/API/setup/deleteLocation"
				};

			case DATA_SETS.BOM_ENTRIES:
				return {
					idField:           "lineID",
					readAPIArrayField: "bom",

					createAPI:         "/API/setup/createBOMExtra",
					readAPI:           "/API/setup/getBOMExtra",
					updateAPI:         "/API/setup/updateBOMExtra",
					deleteAPI:         "/API/setup/deleteBOMExtra",

					subscribeTopics:   ["SRV/bom/" + params.locationID]
				};

			case DATA_SETS.STATUS:
				return {
					idField:           "locationID",
					readAPIArrayField: "status",
					readAPI:           "/API/monitor/getStatus",
					subscribeTopics:   []
				};

			case DATA_SETS.PREPAY_CODES:
				return {
					idField:           "code",
					subscribeTopics:   ["SRV/prepayCodes/" + params.service],
					createAPI:         "/API/prePay/createCode",
					readAPI:           "/API/prePay/getCodes",
					deleteAPI:         "/API/prePay/revokeCode",
					readAPIArrayField: "codes"
				};

			case DATA_SETS.CONTROL_HISTORY:
				return {
					idField:           "instructionID",
					subscribeTopics:   ["SRV/control/" + params.locationID],
					readAPI:           "/API/deviceControl/getControlHistory",
					readAPIArrayField: "history"
				};
		}
	},

	COREsendPing                = (self) => {

		if ((self.authenticated) || (self.useKey)) {
			if ((self.primaryWebSocket) && (self.primaryWebSocketState === WS_STATE.OPEN)) {
				self.primaryWebSocket.send(JSON.stringify({
					type: "PING"  //Heartbeat
				}));
			}
			else if (!self.useKey) {
				let
					request = https.request(
						{
							host: self.options.domain,
							path:   "/heartbeat",
							method: "GET"
						},

						noop
					);

				request.end();
			}
			self.hbTimer = setTimeout(COREsendPing, self.heartbeatInterval, self);
		}
		else {
			self.hbTimer = null;
		}
	},

	COREopenPrimaryWebSocket    = (self) => {

		var subscribe = () => {
				self.webSocketPushHandlers.forEach((pushHandler) => {
					console.log("Subscribing to " + pushHandler.topic);
					self.primaryWebSocket.send(JSON.stringify({
						type:  "SUB",
						topic: pushHandler.topic
					}));
				});
			},

			onOpen    = (err, socket) => {
				var 
					pingCycle = () => {
						///Repeatedly ping the server until we get a response.

						//The longer the outage, the longer the interval between requests up to a maximum
						//of 12 seconds. A random element prevents all clients pinging the server at the
						//exact same moment following a breif hiccup.
						self.reconnectAttempts += 1;

						setTimeout(() => {
							
							console.log("Pinging server...");

							var
								request = https.request(
									{
										host: self.options.domain,
										path: "/ping",
										method: "GET"
									},

									(res) => {

										if (res.statusCode !== 200) {
											pingCycle();
											return;
										}

										console.log("Server alive!");
										
										//Success! It is possible to communicate with the server but we can't
										//assume the server will recognise our authentication token. We need
										//to reauthenticate before we can re-open the web socket.

										if (self.authenticated) {
											self.logOn(
												() => {
													//Successfully reauthenticated.
													//Now try connecting to the websocket again...
													self.myJobQueue.enqueue(COREmakeWebSocketConnection, context);
												},

												pingCycle
											);
										}
										else {
											self.primaryWebSocketState = WS_STATE.CLOSED;
											self.emit("error", new Error("Unable to reauthenticate following a connection break."));
										}
									}
								);

							request.on("error", pingCycle);

							request.end();

						}, Math.min(1000 * self.reconnectAttempts, 10000) + (Math.random() * 2000));		
					};

				if (err) {
					//Socket and close are undefined.
					//We don't need to remove the job from HRQ.

					//At this point, an existing websocket dropped out and our first attempt to reconnect
					//resulted in this error. The error message doesn't tell us the HTTP status code so we
					//don't know if the server restarted for some reason of if the internet connection
					//flaked on us. What is really disappointing is that the message in the console window
					//will show us the cause but we can't determine the reason from code.

					
					if (console && console.log) {
						console.error("The websocket connection encountered an error.");
						console.error(err);
					}

					self.primaryWebSocketState = WS_STATE.RECONN;

					//pingCycle() will keep pinging the server until it gets a 200 OK.
					pingCycle();

					return;
				}

				self.emit("connectionRestore");

				self.primaryWebSocket      = socket;
				self.primaryWebSocketState = WS_STATE.OPEN;
				self.reconnectAttempts     = 0;

				socket.on("close", () => {

					self.primaryWebSocket      = undefined;

					if (self.primaryWebSocketState === WS_STATE.CLOSING) {
						//Intentional close on log off
						self.primaryWebSocketState = WS_STATE.CLOSED;
					}
					else {
						self.primaryWebSocketState = WS_STATE.RECONN;
						self.myJobQueue.enqueue(COREmakeWebSocketConnection, context);
					}
				});

				subscribe();

				self.pendingWebSocketRequests.forEach((request) => {
					self.request(request);
				});

				self.pendingWebSocketRequests = [];
			},

			onMessage = (message) => {
				///Decide what action to take when a message comes in through the primary web socket connection.
				var a = 0,
					msg;


				try {
					msg = JSON.parse(message);

					if (!msg.type || ((msg.type !== "PONG") && (msg.data === undefined))) {

						if ((msg.state === "ERROR") && (typeof msg.additional === "string") && (msg.additional.indexOf("Not logged in") > -1)) {

							if (self.authenticated) {
								console.log("wut?");
							}

							return;
						}
						else {
							self.emit("error", new Error("Received message in unrecognised format."));
						}
					}
				}
				catch(e) {
					self.emit("error", new Error("Unable to understand message from server."));
					console.log(e);
					// console.log(message);
					return;
				}

				if (msg.type === "RES") {
					//Response to a request.

					for (a = self.sentWebSocketRequests.length - 1; a >= 0; a -= 1) {
						if (self.sentWebSocketRequests[a].id === msg.id) {
							if (msg.code < 300) {
								//Hopefully a 200 OK 
								self.sentWebSocketRequests[a].context.onSuccess(msg.data);
								self.sentWebSocketRequests[a].complete();
							}
							else {
								//Ah, crap.

								//Get and immediately invoke a fail handler function.
								COREgetFailHandler.call(self, self.sentWebSocketRequests[a].context, self.sentWebSocketRequests[a].complete)({
									status:     msg.code,
									additional: msg.additional || (msg.data ? msg.data.additional : undefined)
								});
							}

							//Clean up
							self.sentWebSocketRequests.splice(a, 1);
							break;
						}
					}
				}
				else if (msg.type === "PUB") {
					//Information published to a topic we have previously subscribed to.
					for (a = self.webSocketPushHandlers.length - 1; a >= 0; a -= 1) {
						if (self.webSocketPushHandlers[a].topic === msg.topic) {
							self.webSocketPushHandlers[a].handler(msg.data);

							//Do not break here. There can be multiple registered handlers.
						}
					}
				}
				else if (msg.type === "PONG") {
					console.log("PONG message received.");
				}
				else {
					console.log("Message type not recognised:", message);
				}
			},

			context   = {
				url:       "wss://" + self.options.domain + "/API/primary",
				debug:     "primary",
				onOpen:    onOpen,
				onMessage: onMessage,

				self:      self,

				key:       self.token
			};


		self.primaryWebSocketState = WS_STATE.OPENING;
		self.myJobQueue.enqueue(COREmakeWebSocketConnection, context);
	},

	COREgetFailHandler          = (context, complete) => {
		return function(status) {

			if (status.status === 401) {
				lo.logOff();	//Will return without doing anything if not currently in a logged in state.

				if (context.onFailure) {
					context.onFailure(status.status, status.additional);
				}

				complete();
				return;
			}

			if (context.critical) {

				switch (status.status) {

					case -1:	//Deliberate fall through
					case 0:
						//Timeout, internet connection break, etc.
						if (context.onFailure) {
							context.onFailure(status.status, status.additional);
						}
						break;

					case 400:
						//This really ought to be caused by a client side bug and should never happen in a production system.
						throw new Error("400 - Bad Request (" + context.resource + ")");
						//console.log(context.params);

					//case 401:    Already handled above
					//	break;

					case 403:
						//The client IP has been blocked or the client side software has a bug in that it did not
						//restrict the user from attempting something they're not permitted to do. 
						throw new Error("403 - Forbidden (" + context.resource + ")");


					case 404:
						//The client side or server side software has a bug (e.g. a mis-spelt URL)
						throw new Error("404 - File not found (" + context.resource + ")");
						
					case 405:
						throw new Error("405 - Method not allowed (" + context.resource + ")");

					case 429:
						//Too many requests (should never happen as jobqueue implemented to prevent it).
						if (context.onFailure) {
							context.onFailure(status.status, status.additional);
						}
						break;
						
					case 500:
						throw new Error("500 - Internal server error in " + context.resource);


					default:
						throw new Error("Unrecognised error condition (" + status.status + ") while retrieving " + context.resource + "\n\n" + (status.statusText ? status.statusText : ""));
				}

			}
			else {
				if (context.onFailure) {
					context.onFailure(status.status, status.additional);
				}
			}

			complete();
		};
	},


	//JOBS THAT CAN BE ENQUEUED IN the JOB QUEUE:
	COREmakeWebSocketConnection = (context, complete, abort) => {	//jshint ignore:line

		var
			webSocket,
			opened    = false,
			completed = false,
			id = Math.random();

		// console.log("key: ", context.key);

		if (context.key.trim().startsWith("token")) {
			webSocket = new WebSocket(
				context.url,

				{
					headers: {
						cookie: context.self.token
					}
				}
			);
		}
		else {
			webSocket = new WebSocket(
				context.url + "?api_key=" + encodeURIComponent(context.key)
			);
		}

		webSocket.on("open", () => {
			console.log("Socket opened: ", id);
			opened = true;
			context.onOpen(null, webSocket);
		});

		webSocket.on("message", context.onMessage);

		webSocket.on("close", () => {
			console.log("Socket closed: ", id);			

			if (!completed) {
				completed = true;
				complete();
			}
		});

		webSocket.on("error", (err) => {
			if (!opened) {
				context.onOpen(err);

				if (!completed) {
					completed = true;
					complete();
				}
			}
			else {
				console.log("Websocket error", id);

				COREmakeWebSocketConnection(context, complete, abort);
			}
		});
	},

	COREmakeWsRequest           = (context, complete) => {
		///Makes a requests for a resource by the Primary WebSocket.

		if (context.self.primaryWebSocket) {
			context.self.lastIDRequest += 1;

			context.self.sentWebSocketRequests.push({
				id:        context.self.lastIDRequest,
				context:   context,
				complete:  complete,
				ts:        new Date()
			});
			
			context.self.primaryWebSocket.send(JSON.stringify({
				type:      "REQ", //Request
				id:        context.self.lastIDRequest,
				resource:  context.resource,
				params:    context.params
			}));
		}
		else {
			console.log("Boo");
		}

		COREcheckTimer(context.self);
	},

	COREmakeHttpRequest         = (context, complete, abort) => { //jshint ignore:line
		///Makes a requests for a resource by normal HTTP

		//We never actually want to call abort since jobs maybe entirely disperate.
		var url = HTTPS_URL + context.resource;

		if (context.params) {
			url += "?" + $httpParamSerializer(context.params);
		}

		var httpRequest = https.request({

		});

		httpRequest.end();


		$http(
			Object.merge(
				{
					//Defaults
					method: "GET",
					url:    url
				},

				context.options
			)
		).then(
			(returnData) => {
				context.onSuccess(returnData);
				complete();
			},

			COREgetFailHandler.call(this, context, complete, abort)
		);
	};


class MMG2CoreAPI extends EventEmitter {
	static version    = "0.2";  //jshint ignore:line

	static DATA_SETS  = DATA_SETS;
	static CRUD_TYPES = CRUD_TYPES;

	//==========================================

	constructor(opts) {

		super();
		super.constructor();

		this.options                  = opts;
		this.token                    = null;
		this.useKey                   = false;

		this.primaryWebSocket         = null;
		this.primaryWebSocketState    = WS_STATE.CLOSED;

		this.webSocketPushHandlers    = [];       //List of callback functions to handle published messages.
		this.authenticated            = false;

		this.myJobQueue               = new JobQueue();
		this.queueStarted             = false;
		this.reconnectAttempts        = 0;
		this.sentWebSocketRequests    = [];   //Requests awaiting a response.
		this.pendingWebSocketRequests = [];   //Requests waiting for the websocket to open before sending.
		this.lastIDRequest            = 0;    //Simple ID number to match request with response.
	
		this.timeout                  = 30000;  //30 second default timeout
		this.timer                    = null;

		this.heartbeatInterval        = 50000; //(14 * 60 * 1000), 		//14 minutes
		this.hbTimer                  = null;
	}

	setKey(key) {
		if (this.authenticated) {
			throw new Error("Cannot set API key if already using a sesson.");
		}

		this.token = key;
		this.useKey = true;


		if (!this.hbTimer) {
			this.hbTimer = setTimeout(COREsendPing, this.heartbeatInterval, this);
		}
	}

	logOn(onSuccess, onFailure) {

		var logOnRequest;

		if (this.useKey) {
			throw new Error("No point in starting a session after setting API key.");
		}

		console.log("Attempting to log in to " + this.options.domain + " as '" + this.options.username + "'....");


		logOnRequest = https.request(
			{
				host: this.options.domain,
				path: "/API/logOn.js" + 
						"?un=" + encodeURIComponent(this.options.username) +
						"&pw=" + encodeURIComponent(this.options.password),

				method: "GET"
			},

			(res) => {
				this.authenticated = (res.statusCode === 200);

				if (this.authenticated) {
					this.token = res.headers["set-cookie"][0].split(";")[0];
					onSuccess();
				}
				else {
					onFailure(new Error(AUTH_ERROR));
				}
			}
		);

		logOnRequest.end();

		if (!this.hbTimer) {
			this.hbTimer = setTimeout(COREsendPing, this.heartbeatInterval, this);
		}
	}

	logOff(onSuccess, onFailure) {
		if ((this.primaryWebSocketState === WS_STATE.OPENING) || (this.primaryWebSocketState === WS_STATE.OPEN)) {
			
			//this.primaryWebSocketState shall be set to CLOSED by the 'close' event handler.
			//Setting this.primaryWebSocketState to CLOSING causes the 'close' event handler not to attempt to reconnect.
			this.primaryWebSocketState = WS_STATE.CLOSING;

			this.primaryWebSocket.close();
		}


		if (this.hbTimer) {
			clearTimeout(this.hbTimer);
			this.hbTimer = null;
		}


		var logOffRequest = https.request(
			{
				host:    this.options.domain,
				path:    "/API/logOff.js",
				timeout: 2000,
				method:  "GET",
				headers: {
					cookie: this.token
				}
			},

			(res) => {
				this.authenticated = false;

				this.token = null;

				if (res.statusCode === 200) {
					onSuccess();
				}
				else {
					console.log(res.statusCode);
					onFailure(new Error(AUTH_ERROR));
				}
			}
		);

		logOffRequest.end();   //end() causes the request to be sent.
	}

	getMaintainedList(dataSet, params, callBack) {
		var config = COREgetLDMConfig(dataSet, params),
			list;

		config.params   = params;
		config.onUpdate = callBack;

		return new LiveDataManager(this, config);
	}

	request(context) {
		///Adds a request for a resource to the job queue.

		//'context' is an object like:
		//{
		//	resource:   Name of API to request,
		//  params:     List of parameters to pass to API.
		//	options:    HTTP options (e.g. timeout),
		//	onSuccess:  Call back to call when data received,
		//	onFailure:  Call back for to call in event of a failure,
		//	critical:   Boolean - show critical error on network failure
		//}


		//Default to true. Permit to be overridden.
		if (context.critical === undefined) {
			context.critical = (context.onFailure ? false : true);
		}

		if (context.useHTTP) {
			//No longer the default option
			this.myJobQueue.enqueue(COREmakeHttpRequest.bind(this), context);
		}
		else {
			if (this.primaryWebSocket) {
				if (this.primaryWebSocket.readyState === this.primaryWebSocket.OPEN) {
					//WebSocket is already a thing and is open.
					context.self = this;
					this.myJobQueue.enqueue(COREmakeWsRequest, context);
				}
				else {
					//Add to the list of requests to make when the WebSocket is opened.
					this.pendingWebSocketRequests.push(context);
				}
			}
			else {
				//Websocket not a thing. Make it a thing.
				this.pendingWebSocketRequests.push(context);
				if (this.primaryWebSocketState === WS_STATE.CLOSED) {
					COREopenPrimaryWebSocket(this);
				}
			}
		}

		if (!this.queueStarted) {
			this.queueStarted = true;
			this.myJobQueue.setLimit(3);
			this.myJobQueue.start();
		}
	}

	registerPushHandler(topic, handler) {
		var unfolded = [],

			containsMatch = (newTopic, oldTopics) => {
				if (Array.isArray(oldTopics)) {
					for (let b = oldTopics.length - 1; b >= 0; b -= 1) {
						if (newTopic === oldTopics[b]) {
							return true;
						}
					}
				}
				else {
					if (newTopic === oldTopics) {
						return true;
					}
				}
			},

			sub = (thisTopic) => {
				console.log("Subscribing to " + thisTopic);

				this.webSocketPushHandlers.push({
					topic:   thisTopic,
					handler: handler
				});
			};

		
		if (Array.isArray(topic)) {
			//Search for duplicate entries
			for (let b = topic.length; b >= 0; b -= 1) {
				if (this.webSocketPushHandlers[a].handler === handler) {
					for (let a = this.webSocketPushHandlers.length - 1; a >= 0; a -= 1) {
						if (containsMatch(topic[b], this.webSocketPushHandlers).topic) {
							//Duplicate combination of topic and handler. Remove.
							console.log("Dupliacate topic/handler combination ignored. Topic: ", topic[b]);
							topic.splice(b, 1);
						}
					}
				}
			}

			if (!thisTopic.length) {
				return;
			}

			//Append unique topics to webSocketPushHandlers
			topic.forEach(sub);
		}
		else {
			for (let a = this.webSocketPushHandlers.length - 1; a >= 0; a -= 1) {
				if (this.webSocketPushHandlers[a].handler === handler) {
					if (containsMatch(topic, this.webSocketPushHandlers[a].topic)) {
						//Duplicate combination of topic and handler. Remove.
						console.log("Dupliacate topic/handler combination ignored. Topic: ", topic);
						return;
					}
				}
			}

			sub(topic);
		}


		for (let a = this.webSocketPushHandlers.length - 1; a >= 0; a -= 1) {
			if (this.webSocketPushHandlers[a].handler === handler) {

				if (Array.isArray(this.webSocketPushHandlers[a].topic)) {
					if (containsMatch());
				}
				else {
					if (containsMatch(this.webSocketPushHandlers[a].topic, )) {
						//Duplicate request. Ignore.
						return;
					}
				}

			}
		}


		if (this.authenticated || this.useKey) {
			if ((this.primaryWebSocket) && (this.primaryWebSocket.readyState === this.primaryWebSocket.OPEN)) {

				this.primaryWebSocket.send(JSON.stringify({
					type:  "SUB",
					topic: topic
				}));
			}
			else if (this.primaryWebSocketState === WS_STATE.CLOSED) {
				COREopenPrimaryWebSocket(this);
			}
		}
	}

	unregisterPushHandler(topics, handler) {
		var removeHandler = (topic) => {
				var a    = 0,
					keep = false;

				for (a = this.webSocketPushHandlers.length - 1; a >= 0; a -= 1) {
					if (this.webSocketPushHandlers[a].topic === topic) {
						
						if (handler === this.webSocketPushHandlers[a].handler) {
							this.webSocketPushHandlers.splice(a, 1);
						}
						else {
							keep = true;
						}
					}
				}

				return keep;
			};

		if (Array.isArray(topics)) {
			if (!topics.length) {
				return;
			}

			topics.forEach((myTopic, idx) => {
				if (removeHandler(myTopic)) {
					//Found another handler registered to the same event so we cannot
					//unsubscribe from this topic.
					topics.splice(idx, 1);
				}
			});
		}
		else {
			if (removeHandler(topics)) {
				//Found another handler registered to the same event so we cannot
				//unsubscribe from this topic.
				return;
			}
		}

		if ((this.primaryWebSocket) && (this.primaryWebSocketState === WS_STATE.OPEN)) {
			
			if (Array.isArray(topics)) {
				topics.forEach((topic) => {
					console.log("Unsubscribing from " + topic);
				});
			}
			else {
				console.log("Unsubscribing from " + topics);
			}

			this.primaryWebSocket.send(JSON.stringify({
				type: "UNSUB",
				topic: topics
			}));
		}
	}
}



const
	//PRIVATE METHODS FOR LiveDataManager

	LDMsanityCheck              = (self, funcName) => {
		if (self.slain) {
			//All references to this instance should have been discarded at the point it was told to die.
			throw new Error("LiveDataManager." + funcName + "(): You cannot ask me to do something after my brutal murder. It's just not cricket, old boy.");
		}
	},

	LDMcallUpdate               = (self, change) => {
		//The purpose of this function is to prevent onUpdate being
		//called excessively when a batch of updates come through.
		if (!self.updateTimer) {
			self.updateTimer = setTimeout(() => {

				if (self.slain) {
					return;
				}

				self.options.onUpdate(self.data, self.changes);
				self.changes = [];
				self.updateTimer = null;
			}, 10);
		}
	},

	LDMonNewMessage             = (self, entity) => {
		///Handles an incoming message from a subscribed topic

		self.changes.push(entity);
		let cancel = false,

			preventDefault = () => {
				cancel = true;
			},

			getIndex = () => {
				for (a = 0; a < self.data.length; a += 1) {
					if (entity[self.options.idField] === self.data[a][self.options.idField]) {
						return a;
					}
				}

				return -1;
			};


		if (entity.crud === MMG2CoreAPI.CRUD_TYPES.UPDATE) {
			let index = getIndex();

			if (index === -1) {
				entity.crud = MMG2CoreAPI.CRUD_TYPES.CREATE;
			}
			else {
				self.emit(
					"beforeUpdate",

					{
						before:         self.data[index],
						after:          entity,
						preventDefault: preventDefault
					}
				);

				if (!cancel) {
					LDMinsertWithoutDuplication(self, self.data, [entity]);
				}
			}
		}

		if (entity.crud === MMG2CoreAPI.CRUD_TYPES.CREATE) {
			self.emit(
				"beforeCreate",
			
				{
					target:         entity,
					preventDefault: preventDefault
				}
			);

			if (!cancel) {
				LDMinsertWithoutDuplication(self, self.data, [entity]);
			}
		}


		if (entity.crud === MMG2CoreAPI.CRUD_TYPES.DELETE) {
			let index = getIndex();

			if (index === -1) {
				return;
			}

			self.emit(
				"beforeDelete",
				
				{
					target:         entity,
					preventDefault: preventDefault
				}
			);

			if (!cancel) {
				self.data.splice(index, 1);
				LDMcallUpdate(self);
			}
		}
	},

	LDMinsertWithoutDuplication = (self, insertInto, newData) => {
		var a     = 0,
			b     = 0,
			row,
			found = false,

			inplaceUpdate = (key) => {
				insertInto[b][key] = row[key];
			};

		for (a = newData.length - 1; a >= 0; a -= 1) {
			row   = newData[a];
			found = false;

			for (b = insertInto.length - 1; b >= 0; b -= 1) {
				if (insertInto[b][self.options.idField] === row[self.options.idField]) {

					Object.keys(row).forEach(inplaceUpdate);		//Doing this way does not break object references and it
					                                                //doesn't remove data if we receive a partial update.
					found = true;
					break;
				}
			}

			if (!found) {
				insertInto.push(row);
			}
		}

		//options.onUpdate(insertInto);
		LDMcallUpdate(self);
	},

	LDMrequestEverything        = (self) => {
		self.requestCount += 1;

		self.hrq.request({
			resource: self.options.readAPI,

			params:   self.options.params,

			critical: self.options.critical,

			onSuccess: ((rc) => {
				return (msg) => {

					if ((rc !== self.requestCount) || (self.slain)) {
						//This can happen if the LDM is reset before data comes in.
						return;
					}

					//We're doing something odd here.

					//We have deliberately subscribed to the topic before requesting the initial readings so that we can't miss
					//anything. There is a possibility that we got an update before we got the history. We need therefore to
					//treat whats in the data as more current than msg.data:
					if (msg.state === "OK") {
						LDMinsertWithoutDuplication(self, msg.data[self.options.readAPIArrayField], self.data);
						self.data = msg.data[self.options.readAPIArrayField];

						self.emit("init", self.data);
					}
					else if (self.options.onFailure) {
						self.options.onFailure(msg.additional);
					}
				};
			})(self.requestCount),

			onFailure: ((rc) => {
				return (errCode) => {

					if ((rc !== self.requestCount) || (self.slain)) {
						//rc !== this.requestCount can happen if the LDM is reset before data comes in.
						return;
					}

					if (self.options.onFailure) {
						self.options.onFailure(errCode);
					}
				};
			})(self.requestCount)
		});
	};


class LiveDataManager extends EventEmitter {

	constructor(hrq, options) {

		super();
		super.constructor();

		if (!(hrq instanceof MMG2CoreAPI)) {
			throw new Error("LiveDataManager: Missing ");
		}

		if (!options) {
			//Options is not optional. Help me. I'm having an existential crisis.
			throw new Error("LiveDataManager: Missing 'options'.");
		}

		this.changes     = [];
		this.hrq         = hrq;
		this.options     = options;
		this.slain       = false;
		this.data        = [];
		this.updateTimer = null;
		this.requestCount = 0;

		this.publicationHandler = (msg) => {
			LDMonNewMessage(this, msg);
		};


		//Options may contain the following optional field:
		//    critical    Set to true if failure to obtain the inital data must cause display of the Critical Error screen. 
		  
		[
			"idField",         //Uniqueness of this field within the data object is enforced. New data overwrites old data.
			"subscribeTopics", //List of topics to subscribe to for new messages from other users. 
			
			//"createAPI",       //API to call to create a new entry.
			"readAPI",           //API to call to obtain initial data set.
			"readAPIArrayField",
			//"updateAPI",       //API to call to update an entry.
			//"deleteAPI",       //API to call to delete an entry.

			//"params",          //Object containing API request parameters for initial request (can be an empty object)
			//"onUpdate"         //Function to call when there is an update to the data.
			//"onSuccess",       //Function to call when publication of new data succeeds.
			//"onFailure"        //Function to call when publication of new data fails.

		].forEach((reqParam) => {
			if (this.options[reqParam] === undefined) {
				//Option is not optional :/ Help me.
				throw new Error("LiveDataManager(): Come on now, pay attention. options." + reqParam + " is not optional.");
			}
		});

		this.options.params    = this.options.params    || {};
		this.options.onUpdate  = this.options.onUpdate  || noop;
		this.options.onSuccess = this.options.onSuccess || noop;
		this.options.onFailure = this.options.onFailure || noop;

		//Listen for updates...
		this.options.subscribeTopics.forEach((subscribeTopic) => {
			this.hrq.registerPushHandler(subscribeTopic, this.publicationHandler);
		});

		//Get all messages...
		LDMrequestEverything(this);
	}

	create(newData, onSuccess, onFailure) {

		if (!options.createAPI) {
			throw new Error("LiveDataManager.createAPI(): You have not defined a create API.");
		}

		LDMsanityCheck(this, "create");

		this.hrq.request({
			resource:  this.options.createAPI,
			params:    newData,
			critical:  this.options.critical,
			onSuccess: onSuccess || this.options.onSuccess || noop,
			onFailure: onFailure || this.options.onFailure || noop   
		});
	}

	read() { return this._data; }

	update(newData, onSuccess, onFailure) {

		if (!this.options.updateAPI) {
			throw new Error("LiveDataManager.update(): You have not defined an update API.");
		}

		LDMsanityCheck.bind(this)("update");

		this.hrq.request({
			resource:  this.options.updateAPI,
			params:    newData,
			critical:  this.options.critical,
			onSuccess: onSuccess || this.options.onSuccess || noop,
			onFailure: onFailure || this.options.onFailure || noop
		});
	}

	delete(newData, onSuccess, onFailure) {
		if (!this.options.deleteAPI) {
			throw new Error("LiveDataManager.delete(): You have not defined a delete API.");
		}

		LDMsanityCheck.bind(this)("delete");

		this.hrq.request({
			resource:  this.options.deleteAPI,
			params:    newData,
			critical:  this.options.critical,
			onSuccess: onSuccess || this.options.onSuccess || noop,
			onFailure: onFailure || this.options.onFailure || noop 
		});			
	}

	reset(params, newTopics) {

		this.data.splice(0, this.data.length);   //Empty the array without breaking references to it.

		if (newTopics) {

			//Unsubscribe from topics that we no longer wish to be subscribed to
			this.options.subscribeTopics.forEach((topic) => {
				if (newTopics.indexOf(topic) === -1) {
					this.hrq.unregisterPushHandler(topic, this.publicationHandler);
				}
			});

			//Subscribe to new topics
			newTopics.forEach((topic) => {
				if (this.options.subscribeTopics.indexOf(topic) === -1) {
					this.hrq.registerPushHandler(topic, this.publicationHandler);
				}
			});

			this.options.subscribeTopics = newTopics;
		}

		this.options.params = params;
		LDMrequestEverything(this);
	}

	die() {
		if (this.slain) {
			//All references to this instance should have been discarded at the point it was told to die.
			throw new Error("LiveDataManager.die(): Called multiple times. I can only get so dead.");
		}

		this.options.subscribeTopics.forEach((topic) => {
			this.hrq.unregisterPushHandler(topic, this.publicationHandler);
		});
		
		this.slain   = true;
		this.data    = undefined;
		this.options = undefined;
	}
}


module.exports = { MMG2CoreAPI, LiveDataManager, JobQueue };