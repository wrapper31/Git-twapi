/*
 *	2013-01-11
 *	Public Domain.
 *	NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.
 *
 *	Generic a BPMJSON utiltiy for convertion of IBM BPM (8.0.x, 8.5.x) TW Objects to JS objects and JSON strings and vice versa.
 *  The Javascript function interacts with two types of Objects:
 *    1. JS Object (refers to Javascript object)
 *    2. TW Object (referes to BPM data types BO)
 *  
 *
 *	@author: Mohamed Maher
 *	@version: 2.9 - added convertJSONToTw function
 *  @modified: 2013-08-18
 */

/* Create BPMJSON object only if one does not already exist. Name space for the library */
if (!this.BPMJSON) {
	this.BPMJSON = {};
}

(function () {	
	//Date Formating		
	/** format Date to String.  format: '2013-01-16 23:00:00' */
	if (typeof BPMJSON.formatUTCDate !== 'function') {
		BPMJSON.formatUTCDate = function (date) {
			function pad(n) { // Format integers to have at least two digits.
				return n < 10 ? '0' + n : n;
			}
			//log.info("Date Condition: "+(date != undefined && date != null && date.constructor == Date));
			return (date != undefined && date != null && date.constructor == Date) ?
			date.getUTCFullYear() 		+ '-' +
			pad(date.getUTCMonth() + 1) + '-' +
			pad(date.getUTCDate()) 		+ ' ' + // Removed T because it fails with FF "invalid date"
			pad(date.getUTCHours()) 	+ ':' +
			pad(date.getUTCMinutes()) 	+ ':' +
			pad(date.getUTCSeconds())	+ 'Z' : null;			
		};
	}		
	
	///////////////////////////////////////////////////////////////////////////////
	// TW Methods
	/** Parse string to TWDate from this UTC Date ISO format  "yyyy-MM-dd'T'HH:mm:ss'Z'" */
	if (typeof BPMJSON.parseTWDate !== 'function') {
		BPMJSON.parseTWDate = function (strDate) {
			var twDate = new tw.object.Date();
			try {
				twDate.parse(strDate, "yyyy-MM-dd'T'HH:mm:ss'Z'");
			} catch (e) {
				//just return current date
			}
			return twDate;
		};
	}
	
	/** Format TWDate to a String in this UTC Date ISO format "yyyy-MM-dd'T'HH:mm:ss'Z'"*/
	if (typeof BPMJSON.formatTWDate !== 'function') {
		BPMJSON.formatTWDate = function (twDate) {
			var twDateStr = null;
			try {
				twDateStr = twDate.format("yyyy-MM-dd'T'HH:mm:ss'Z'");
			} catch (e) {
				//just return null
			}
			return twDateStr;
		};
	}
	
	/** Check if the TW Object is a list by checking that it has a toXML function and the type attribute has the [] notation. */
	if (typeof BPMJSON._isTWList !== 'function') {
		BPMJSON._isTWList = function (twObject) {
			
			if (!!twObject && typeof twObject == 'object' && Object.prototype.toString.call(twObject).slice(8, -1) == 'TWObject') // typeof twObject.toXML === 'function')
			{
				//Check for list attributes. 
				try {					 
					//check of list without converting object toXML
					if( !!twObject.listLength )
						return true;					
															
				} catch (e) { 
					// could not find a toXML method or listLength and it will return false.
				} 
				
			}
			return false;
		};
	}
	
	/** Get the type of Object to defrentiate between TWDate, Lists and complex types (TWObject)  */
	if (typeof BPMJSON._getTypeOfTWObject !== 'function') {
		BPMJSON._getTypeOfTWObject = function (twObject) {
			
			var typeOfObject = undefined;
			if (twObject != undefined && twObject != null) {
				var typeOfObject = typeof twObject;
				var jsPrototypeType = Object.prototype.toString.call(twObject).slice(8, -1);
				
				if (jsPrototypeType == 'TWDate') {// TWDate
					typeOfObject = "twDate";
				} else if (jsPrototypeType == 'TWObject') {// TWObject
					typeOfObject = "twObject";
				}
				//recheck for lists as they are returned as TWObject
				if (this._isTWList(twObject)) { 
					typeOfObject = "twObjectList";
				}
			}
			return typeOfObject;
		};
	}
	
	/** Return a JS Object from a TW Object*/
	if (typeof BPMJSON._convertToJSObject !== 'function') {
		BPMJSON._convertToJSObject = function (twObject, typeOfObject, addEmptyProperty) {
			
			var newObj = null;
			if (typeOfObject != undefined) {
				//log.debug("*** Type = " + typeOfObject);
				if (typeOfObject == 'twObject' || typeOfObject == 'object') {
					newObj = this._convertObject(twObject, addEmptyProperty);
				} else if (typeOfObject == 'twObjectList') {
					newObj = this._convertArray(twObject, addEmptyProperty);
				} else if (typeOfObject == 'twDate') {
					//log.debug("*** date : " + twObject.toString());
					try {
						if (twObject) {
							var jsDate = twObject.toNativeDate();							
							newObj = this.formatUTCDate(jsDate);  //jsDate.toJSON(); //
						}
					} catch (e) {
						log.info("**Exception in date format"+e);
					}
					//log.debug("*** newObj : " + newObj);
				} else if (typeOfObject == 'string') {
					newObj = String(twObject);
				} else if (typeOfObject == 'number') {
					newObj = Number(twObject);
				} else if (typeOfObject == 'boolean') {
					newObj = Boolean(twObject);
				} else { //unhandeled basic type!!
					log.info("**** Unhandeled TW Object Type for conversion:[type:" +typeOfObject+", object:"+ twObject+"]");
					newObj = twObject;
				}
			}
			return newObj;
		};
	}
	
	/** Convert the TWObject to JSObject  */
	if (typeof BPMJSON._convertObject !== 'function') {
		BPMJSON._convertObject = function (twObject, addEmptyProperty) {
			//function _convertObject(twObject){
			var newObj = null;
			var typeOfObject = this._getTypeOfTWObject(twObject);
			if (twObject && typeOfObject == 'twObject' && !!twObject.propertyNames ) {
				if(addEmptyProperty ==false && twObject.propertyNames.length == 0)
					return null;
				newObj = new Object();
				for (var property in twObject.propertyNames) {
					var name = twObject.propertyNames[property];
					var propVal = twObject[name];
					if (addEmptyProperty == false && (propVal == undefined || propVal == null)) { //skip empty values object
						continue;
					}
					//Identify property Types
					var typeOfValue = this._getTypeOfTWObject(propVal);
					log.debug("name: " + name + ", typeOfValue : " + typeOfValue);
					
					var objValue = this._convertToJSObject(propVal, typeOfValue, addEmptyProperty);
					if (objValue != null)
						newObj[name] = objValue;
				}			
				
			} else { // TWObjectList and TWDates will reach here they do not have propertyNames attributes	
				newObj = this._convertToJSObject(twObject, typeOfObject, addEmptyProperty);
			}
			return newObj;
		};
	}
	
	/** Convert tw List/Array to JSObject*/
	if (typeof BPMJSON._convertArray !== 'function') {
		BPMJSON._convertArray = function (twObjectList, addEmptyProperty) {
			//function _convertArray(twObject){
			var newArray = new Array();
			if (!twObjectList || twObjectList.listLength == 0)
				return null;				
			for (var j = 0;  j < twObjectList.listLength; j++) {
				var newObj = this._convertObject(twObjectList[j], addEmptyProperty);
				if (newObj != null)
					newArray.push(newObj);
			}			
			return newArray;
		};
	}
	
	/****************************************/
	/***** Public Methods to use in BPM *****/
	/** 1. Convert TW Object to a JS Object 
            @since v2.8.0.1
	*/
	if (typeof BPMJSON.convertTwToJS !== 'function') {
		BPMJSON.convertTwToJS = function (twObject) {
			//function convertTwToJS(twObject){
			var addEmptyProperty = false; // it can be a parameter
			var jsObj = null;
			if (!twObject)
				return null;
			
			if (twObject) {
				if (this._isTWList(twObject)) { // twObject.propertyNames["arrayElement"]
					jsObj = this._convertArray(twObject, addEmptyProperty);
				} else {
					jsObj = this._convertObject(twObject, addEmptyProperty);
				}
			}
			return jsObj;
		};
	}
	
	/** 2. Convert TW Object to JSON String.  Requires JSON Toolkit or json2.js from http://www.json.org/ 
	    e.g. of removeAttributesList : array of strings ( ['attr1','attr2'] )  or comma separated attributes string ("attr1,attr2")
            @since v2.8.0.1
	*/
	if (typeof BPMJSON.convertTwToJSON !== 'function') {
		BPMJSON.convertTwToJSON = function (twObject, removeAttributesList) {
			//function convertTwToJSON(twObject){
			var jsonStr = null;
			if (!twObject)
				return null;
			
			if (twObject) {
				var jsObj = BPMJSON.convertTwToJS(twObject);
				//log.debug("jsObj before remove: "+jsObj);
				var newJsObj = jsObj;
				if(!!removeAttributesList && removeAttributesList.length ){					
					newJsObj = BPMJSON.removeJSObjectAttributes(jsObj, removeAttributesList);
					//log.debug("jsObj after remove: "+jsObj);
				}
				jsonStr = JSON.stringify(jsObj); //@call of json2.js method
				delete jsObj;
			}
			return jsonStr;
		};
	}
	
	/** 3. Convert JS Object to JSON String.  Requires JSON Toolkit or json2.js from http://www.json.org/ 
	    @since v2.8.0.1
	*/
	if (typeof BPMJSON.convertJSToJSON !== 'function') {
		BPMJSON.convertJSToJSON = function (jsObj) {
			//function convertJSToJSON(twObject){
			var jsonStr = "";
			if (!twObject)
				return "";			
			else {
				jsonStr = JSON.stringify(jsObj); //@call of json2.js method				
			}
			return jsonStr;
		};
	}
	
	/** 4. Remove listed attributes from the JS Object. 
	    This is usefull if you want to remove unrequired JS objects before converting to JSON string.
	    Example for listOfAttributes :  ['attr1','attr2'] or "attr1,attr2"
	    - you can call this method again on child complext attribute to remove other children attributes that is not required.
            @since v2.8.0.1
	*/
	if (typeof BPMJSON.removeJSObjectAttributes !== 'function') {
		BPMJSON.removeJSObjectAttributes = function (obj, listOfAttributes) {
			//function removeJSObjectAttributes(obj, listOfAttributes){
			if (!!obj && !!listOfAttributes && listOfAttributes.length) {
				var arrayOfAttributes = listOfAttributes;
				if( typeof listOfAttributes ===  'string' ) 
						arrayOfAttributes = listOfAttributes.split(',');
				for (var i = 0; i < arrayOfAttributes.length; i++) {
					var attrib = arrayOfAttributes[i];
					delete obj[attrib];
				}
			}
		};
	}

	/** 5. Convert JSON to JS Object and can be assigned to the matching TW object.  
	    Requires JSON Toolkit or json2.js from http://www.json.org/ 
	    @since v2.9
	*/
	if (typeof BPMJSON.convertJSONToTw !== 'function') {
		BPMJSON.convertJSONToTw = function (jsonText) {
			//function convertJSONToTW(jsonText){
			var jsObj = null;

			if (jsonText == null || jsonText == undefined)
				return null;			
			else {
				//@call of json2.js method with Date handler
				jsObj = JSON.parse(jsonText, function (key, value) {
					var a;
					if (typeof value === 'string') {
					    a = /^(\d{4})-(\d{2})-(\d{2})(\s|T)(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z?$/.exec(value);
					    if (a) {
						return new Date(Date.UTC(+a[1], +a[2] - 1, +a[3], +a[4],
						    +a[5], +a[6]));
					    }					   
					}
					return value;
				    });

			}
			return jsObj;
		};
	}	
			
} ());
