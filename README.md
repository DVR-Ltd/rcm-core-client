# RCM Core Client Library

## Overview

This library is used to interact with the MMG2 Core API.

The MMG2 Core API allows clients to request updates to data sets over a websocket connection. After the server receives a `subscription` to a `topic` from a client, it shall send that client a `publication` whenever an event happens on that `topic`. The events maybe `CREATE`, `UPDATE` or `DELETE`.

This library consists of three classes: `MMG2CoreAPI`, `LiveDataManager` and `JobQueue`.

`MMG2CoreAPI` is essential to all users of this library. It facilitates authenticated connections, connection loss handling, API calls and push notification management.

The `LiveDataManager` class is used to simplify responding to real time events. The construction of a LiveDataManager can be a bit daunting to new users, so the `MMG2CoreAPI` class includes a convenient method to return instances of `LiveDataManager`.

The `JobQueue` class is used internally to keep API call rates within server imposed limitations. It's made available to use in your own application if desired but it's usage is in no way required.

## The MMG2CoreAPI Class

All connections to MMG2 servers must be authenticated. There are two supported methods of authentication.

For situations like server side applications where credentials maybe the same for all installations, API key authentication is usually the preferred method.

For situations like mobile or desktop applications where it is assumed that attackers can gain access to the application and extract any credentails encoded within it, session token authentication is supported. In this scenario, the end user is expected to enter their own credentials in order to log in. When they log on successfully, a token is given which is subsequently sent in the headers of all API calls.

### Methods

#### constructor(<object: options>)

#### setKey(<string: key>)

Use only if using API key authentication.


#### logOn(<function: onSuccess>, <function: onFailure>)

Use only if using session token authentication.


#### logOff(<function: onSuccess>, <function: onFailure>)	

Use only if using session token authentication.




#### getMaintainedList(<enum: this.DATA_SETS>,  <object: parameters>, <function: callBack>)

Returns an instance of LiveDataManager configured for the data set you want.

#### request(<object: context>)

Make an API call.


#### registerPushHandler(<string[]: topics>, <function: callBack>)

Register a callback for particular events.

#### unregisterPushHandler(<string[]: topics>, <function: callBack>)


Remove a callback for a particular event.

### Example




## The LiveDataManager Class

The `LiveDataManager` class is used to keep an always up to date set of data in your applications memory. Examples of these data sets include the list of sites, alarms for a site or area, monitoring data from a specific device or group of devices or site, hardware deployments, and much more. 'LiveDataManager' will raise events whenever data is modified allowing you to respond to changes in real time without polling.

The recommended way of obtaining an instance of the `LiveDataManager` class is to request it from the `getMaintainedList()` method of your instance of `MMG2CoreAPI`.

### Methods

#### constructor(<MMG2CoreAPI: connection>, <object: options>)

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
|`onUpdate`|False|Function|Callback called upon ALL updates. For lower level functionality, see `events`.|Function with arguments: <object[]: full_data_set>, <object[]: changed_only>.|



#### create(<object: newData>, <function: onSuccess>, <function: onFailure>)

This method calls the API to create a new entry in the dataset.

#### read()

This method returns the complete data set from memory without using an API call.

#### update(<object: newData>, <function: onSuccess>, <function: onFailure>)

This method calls the API to create a new entry in the dataset. The API will publish the update resulting in the 

#### delete(<object: newData>, <function: onSuccess>, <function: onFailure>)

This method calls the API to delete an entry from the dataset.


#### reset(<object: params>, <string[]: newTopics>)

The `reset()`  command cause the data to be re-queried with new input parameters.

#### die()

The `die()` method is recommended for use when the class is no longer needed. It will cause the class to remove references to data and unregister all handlers. 


### Events

#### `beforeCreate` Event

This event is called when notification of a new entry in the data set is received. The in memory copy of the data set has not been manipulated when this event is triggered. The event handler is passed an object with the following properties:

|Property|Data Type|Description|
|-|-|-|
|target|Object|The object that shall be added to the array if `preventDefault()` is not called.|
|preventDefault|Function|Call to prevent the in-memory array being manipulated by this change and the onUpdate function being called.|


#### `beforeUpdate` Event


This event is called when notification of a change to an entry in the data set is received. The in memory copy of the data set has not been manipulated when this event is triggered. The event handler is passed an object with the following properties:


|Property|Data Type|Description|
|-|-|-|
|before|Object|A reference to the object currently in the array.|
|after|Object|A new object containing updated properties that shall be copied into the 'before' object if 'preventDefault()' is not called.|
|preventDefault|Function|Call to prevent the in-memory array being manipulated by this change.|


#### `beforeDelete` Event

This event is called when notification of removal of an entry from the data set is received. The in memory copy of the data set has not been manipulated when this event is triggered. The event handler is passed an object with the following properties:


|Property|Data Type|Description|
|-|-|-|
|target|Object|The object that shall be removed from the array if `preventDefault()` is not called.|
|preventDefault|Function|Call to prevent the in-memory array being manipulated by this change and the onUpdate function being called.|


### Example


## The JobQueue Class


### Methods

### Example
