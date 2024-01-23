# RCM Core Client Library

## Overview

This library is used to interact with the MMG2 Core API.

In addition to normal RESTful API end points, the MMG2 Core API allows clients to request updates to data sets over a websocket connection. After the server receives a `subscription` to a `topic` from a client, it shall send that client a `publication` whenever an event happens on that `topic`. The events maybe `CREATE`, `UPDATE` or `DELETE`.


## Getting Started

To connect to the API and fetch a list of sites:

```JavaScript

const
	{
		MMG2CoreAPI,
		LiveDataManager
	} = require("rcm-core-client");


let myConnection = new MMG2CoreAPI(
		{
			domain:   "my_domain.com"
			username: "username",    //NOTE: API Key authentication also possible.
			password: "password",
		}
	);


myConnection.logOn(
	() => {
		//On Success
		console.log("Authentication complete");

		let sitesLDM = myConnection.getMaintainedList(
				myConnection.DATA_SETS.SITES,

				null,   //No parameters required for `SITES`.

				(sites) => {
					//This function maybe called if sites are created, renamed or deleted.

					console.log();
					console.log("Sites:")
					console.log("------");
					
					sites.forEach((site) => {
						console.log(site.locationID, site.locationName);
					});
				}
			);


		//After one minute...
		setTimeout(() => {
			sitesLDM.die();

			myConnection.logOff(
				() => {
					console.log("Successful log off");
				},

				(err) => {
					throw err;
				}
			);
			
		}, 60000);
	},

	(err) => {
		//On Failure
		//Authentication or network error"
		throw err
	}
);

```



## Classes

This library consists of three classes:

* [MMG2CoreAPI](#MMG2CoreAPI) is essential to all users of this library. It facilitates authenticated connections, connection loss handling, API calls and push notification management.

* [LiveDataManager](#LiveDataManager) is used to simplify responding to real time events. The construction of a `LiveDataManager` can be a bit daunting to new users, so the `MMG2CoreAPI` class includes a convenient method to return instances of `LiveDataManager`.

* [JobQueue](#JobQueue) is used internally to keep API call rates within server imposed limitations. It's made available to use in your own application if desired but its usage is in no way required.

<a name="MMG2CoreAPI"/>

### The MMG2CoreAPI Class

This library supports both methods of authentication (API key and session token) offered by the MMG2 Core API. You will need to consider which approach works best for your use case.

For situations like server side applications where credentials maybe the same for all installations, API key authentication is usually the preferred method.

For situations like mobile or desktop applications where it is assumed that attackers can gain access to the application and extract any credentails encoded within it, session token authentication is supported. In this scenario, the end user is expected to enter their own credentials in order to log in. When they log on successfully, a token is given which is subsequently sent in the headers of all API calls.



#### Methods

##### constructor(<object: options>)

`options` shall contain the following properties:

|Property|Required|Data Type|Description|Notes|
|-|-|-|-|-|
|`domain`|True|String|The domain name by which the server can be located.|Example: `example.dvr-rcm.co.uk`, `example.meter-macs.com`|
`username`|False|String|The username if using session token authentication.||
`password`|False|String|The password if using session token authentication.||


```JavaScript
//Example
const { MMG2CoreAPI } = require("rcm-core-client");

let myConnection = new MMG2CoreAPI(
		{
			"domain": "example_domain.com",
			"username": "username",
			"password": "password"
		}
	);

myConnection.on("error", (err) => {
	console.log(err);
});

//TO DO: Log on and use API

```



##### setKey(<string: key>)

Use only if using API key authentication.

```JavaScript
const { MMG2CoreAPI } = require("rcm-core-client");

let myConnection = new MMG2CoreAPI(
		{
			"domain": "example_domain.com"
		}
	);

myConnection.on("error", (err) => {
	console.log(err);
});

myConnection.setKey("MY_API_KEY");

//TO DO: Use API
//
```


##### logOn(<function: onSuccess>, <function: onFailure>)

Use only if using session token authentication.

```JavaScript
//Example
const { MMG2CoreAPI } = require("rcm-core-client");

let myConnection = new MMG2CoreAPI(
		{
			"domain": "example_domain.com",
			"username": "username",
			"password": "password"
		}
	);

myConnection.on("error", (err) => {
	console.log(err);
});

myConnection.logOn(
	() => {
		console.log("Log on successful!");
	},

	(err) => {
		//Log on failed!
		throw err;
	}
);
```


##### logOff(<function: onSuccess>, <function: onFailure>)	

Use only if using session token authentication.

```JavaScript
//Assuming myConnection to have already been created and a successful call to myConnection.logOn() to have been made.

myConnection.logOff(
	() => {
		console.log("Log off successful!");
	},

	(err) => {
		//Log on failed!
		throw err;
	}
);
```


##### getMaintainedList(<enum: dataSetIdentifier>[,  <object: parameters>[, <function: callBack>]])

Returns an instance of `LiveDataManager`.

`dataSetIdentifier` is used to set most of the configurable properties of the `LiveDataManager` instance. See table below.

`parameters` is passed to the read API in full. Some properties of `parameters` will be used to configure subscriptions.

`callBack` shall be used to set the `onUpdate` property of the `options` object when constructing the `LiveDataManger`. This function is called whenever data is received. You may wish to omit `callBack` in favour of using [events](#LDMEvents) instead.

`dataSetIdentifier` must be one of the following:

|Enumerator|Notes|
|-|-|
|MMG2CoreAPI.DATA_SETS.SITES|No `parameters` required.|
|MMG2CoreAPI.DATA_SETS.USERS|No `parameters` required.|
|MMG2CoreAPI.DATA_SETS.USERGROUPS|No `parameters` required.|
|MMG2CoreAPI.DATA_SETS.TEMPLATES|No `parameters` required.|
|MMG2CoreAPI.DATA_SETS.SITE_ICONS|`parameters` must contain `locationID` property.|
|MMG2CoreAPI.DATA_SETS.LOCATIONS|`parameters` must contain `locationID` property.|
|MMG2CoreAPI.DATA_SETS.BOM_ENTRIES|`parameters` must contain `locationID` property.|
|MMG2CoreAPI.DATA_SETS.REPORTS|`parameters` must contain `locationID` property.|
|MMG2CoreAPI.DATA_SETS.SCHEDULES|`parameters` must contain `locationID` property.|
|MMG2CoreAPI.DATA_SETS.DEPLOYABLE|`parameters` must contain `locationID` property.|
|MMG2CoreAPI.DATA_SETS.UNDEPLOYABLE|`parameters` must contain `locationID` property.|
|MMG2CoreAPI.DATA_SETS.ALARMS|`parameters` must contain `locationID` property.|
|MMG2CoreAPI.DATA_SETS.PREPAY_CODES|`parameters` must contain `service` property.|
|MMG2CoreAPI.DATA_SETS.CONTROL_HISTORY|`parameters` must contain `locationID` property.|





```JavaScript
//Example

//Assuming myConnection to have already been created and a successful call to myConnection.logOn() to have been made.

let
	logLocation = (loc) => {
		console.log(loc.locationID, loc.locationName);
	};

myConnection.getMaintainedList(
	myConnection.DATA_SETS.LOCATIONS,
	
	{
		locationID: 1      //A known locationID for a site
	},

	(fullSet, changes) => {
		if (!changes) {
			//First run
			fullSet.forEach(logLocation);
		}
		else {
			//Respond to an update
			console.log("Changes:");
			changes.forEach(logLocation);
		}
	}
);
```


##### request(<object: context>)

Make an API call. For most uses, use a `LiveDataManager` instance instead.


```JavaScript
//Assuming myConnection to have already been created and a successful call to myConnection.logOn() to have been made.

//Makes a simple request for the same data as in the last example, but without registering for updates.
myConnection.request({
	resource: "/API/setup/getLocations",

	params: {
		locationID: 1
	},

	onSuccess: (res) => {
		res.data.locations.forEach((loc) => {
			console.log(loc.locationID, loc.locationName);
		});
	},

	onFailure: (err, code) => {
		console.log("Error occurred");
		throw err;
	}
});

```


##### registerPushHandler(<string[]: topics>, <function: callBack>)

Register a callback for particular events. For most uses, use a `LiveDataManager` instance instead.


```JavaScript

//EXAMPLE 1: Subscribing to readings.

//Assuming myConnection to have already been created and a successful call to myConnection.logOn() to have been made.

let
	myMeterLocations = [10, 11, 12, 13],   //Expected that you'll have locationID values from a previous API call

	h_readingsHandler = (locationID) => {
		return (readings) => {
			console.log("Reading for " + locationID + ": " + readings.value);

			console.log("Hardware state for " + locationID + ": " + readings.hwState);
		};
	};

myMeterLocations.forEach((locationID) => {
	myConnection.registerPushHandler(
		"SRV/readings/" + locationID,

		h_readingsHandler(locationID)
	);
});

```



```JavaScript

//EXAMPLE 2: Subscribing to sites (NOTE: Using an instance of LiveDataManager is preferred over this code)

//Assuming myConnection to have already been created and a successful call to myConnection.logOn() to have been made.

let
	sitesHandler = (siteData) => {

		switch (siteData.crud) {

			case myConnection.CRUD_TYPES.CREATE:
				console.log("A new site was created");
				break;

			case myConnection.CRUD_TYPES.UPDATE:
				console.log("A site was modified");
				break;

			case myConnection.CRUD_TYPES.DELETE:
				console.log("A new site was deleted");
				break;				
		}
	};


myConnection.registerPushHandler(["SRV/sites"], sitesHandler);

```




##### unregisterPushHandler(<string[]: topics>, <function: callBack>)

Remove a callback for a particular event. For most uses, use a `LiveDataManager` instance instead.

```JavaScript
//Continuing on from the example for the registerPushHandler() method.
myConnection.unregisterPushHandler(["SRV/sites"], sitesHandler);
```


#### Events

##### `error` Event

The MMG2CoreAPI class will do all it can to restore a connection.

##### `connectionRestore` Event






<a name="LiveDataManager"/>

### The LiveDataManager Class

The `LiveDataManager` class is used to keep an always up to date set of data in your applications memory. Examples of these data sets include the list of sites, alarms for a site or area, monitoring data from a specific device or group of devices or site, hardware deployments, and much more. `LiveDataManager` will raise events whenever data is modified allowing you to respond to changes in real time without polling.

The recommended way of obtaining an instance of the `LiveDataManager` class is to request it from the `getMaintainedList()` method of your instance of `MMG2CoreAPI`.

|:memo:|PLEASE NOTE: It is rarely necessary to understand how to construct a `LiveDataManager`. The `MMG2CoreAPI.getMaintainedList()` method will usually do what you require.|
|-|-|

|:memo:|PLEASE NOTE: LiveDataManager avoids breaking pointers. The same array is used to hold the data set from constructon to destruction and when entities are updated, changes are made to the original objects within the array. This means you should be able to safely use this library with your MVC framework of choice. |
|-|-|

#### Methods

##### constructor(<MMG2CoreAPI: connection>, <object: options>)

`connection` must be a valid instance of the `MMG2CoreAPI` class.


`options` shall have the following properties:

|Property|Required|Data Type|Description|Notes|
|-|-|-|-|-|
|`idField`|True|String|The name of the field that is used by the dataset to uniquely identify each row.||
|`subscribeTopics`|True|String[]|The list of topics the server shall publish updates on.||
|`readAPI`|True|String|The API end point from which the full data set can be read.||
|`readAPIArrayField`|True|String|The name of the property of the data object returned by the API containing the data set.||
|`params`|False|Object|Properties to be sent to the read API.|Required if Read API has non-optional input parameters|
|`createAPI`|False|String|The API end point used to add entities to the data set.|Required if you wish to call the `create()` method.|
|`updateAPI`|False|String|The API end point used to modify entities to the data set.|Required if you wish to call the `update()` method.|
|`deleteAPI`|False|String|The API end point used to delete entities to the data set.|Required if you wish to call the `delete()` method.|
|`onUpdate`|False|Function|Callback called upon ALL updates. Using `onUpdate()` callback may not be optimal in every case, for which the [`LiveDataManager` events](#LDMEvents) exist as an alternative.|Function with arguments: <object[]: full_data_set>, <object[]: changed_entries_only>.|



##### create(<object: newData>, <function: onSuccess>, <function: onFailure>)

This method calls the API to create a new entry in the dataset.

Place API parameters in `newData`.

##### read()

This method returns the complete data set from memory without using an API call.

##### update(<object: newData>, <function: onSuccess>, <function: onFailure>)

This method calls the API to create a new entry in the dataset. The API will publish the update resulting in the 

Place API parameters in `newData`.

##### delete(<object: newData>, <function: onSuccess>, <function: onFailure>)

This method calls the API to delete an entry from the dataset.

Place API parameters in `newData`.

##### reset(<object: params>, <string[]: newTopics>)

The `reset()`  command cause the data to be re-queried with new input parameters.

Place API parameters in `params`.


##### die()

The `die()` method is recommended for use when the class is no longer needed. It will cause the class to remove references to data and unregister all handlers. 

<a name="LDMEvents"/>

#### Events

##### `init` Event

This event is called after the initial retreival of the data set. Calling the `reset()` method will result in the event being triggered again.





##### `beforeCreate` Event

This event is called when notification of a new entry in the data set is received. The in memory copy of the data set has not been manipulated when this event is triggered. The event handler is passed an object with the following properties:

|Property|Data Type|Description|
|-|-|-|
|target|Object|The object that shall be added to the array if `preventDefault()` is not called.|
|preventDefault|Function|Call to prevent the in-memory array being manipulated by this change and the onUpdate function being called.|


##### `beforeUpdate` Event


This event is called when notification of a change to an entry in the data set is received. The in memory copy of the data set has not been manipulated when this event is triggered. The event handler is passed an object with the following properties:


|Property|Data Type|Description|
|-|-|-|
|before|Object|A reference to the object currently in the array.|
|after|Object|A new object containing updated properties that shall be copied into the 'before' object if 'preventDefault()' is not called.|
|preventDefault|Function|Call to prevent the in-memory array being manipulated by this change.|


##### `beforeDelete` Event

This event is called when notification of removal of an entry from the data set is received. The in memory copy of the data set has not been manipulated when this event is triggered. The event handler is passed an object with the following properties:


|Property|Data Type|Description|
|-|-|-|
|target|Object|The object that shall be removed from the array if `preventDefault()` is not called.|
|preventDefault|Function|Call to prevent the in-memory array being manipulated by this change and the onUpdate function being called.|



<a name="JobQueue"/>

### The JobQueue Class


#### Methods



