/* 

Leaflet.greatCircle.js 
Copyright Alex Wellerstein, 2018. 
Licensed under the MIT License: https://opensource.org/licenses/MIT

*/
L.GreatCircle = L.Circle.extend({

	initialize: function (position, options = {}) {
		//default options
		var defaults = {
			clipLat: 80, //lat (+/-) used to determine when regular circles might be used. set to false to force render of circle as polygon (no matter what), or true to render it as a normal circle (no matter what)
			clipRad: 2000000, //radius (m) at which it will always render a polygon, unless clipLat == true. 
			degStep: 0.5, //degrees by which the circle drawing function will step for each polygon -- smaller is more refined. 
			maxCopies: -1, //set a maximum number of copies if elements are wrapped -- -1 is no max. 
			wrapElements: true, //whether to wrap the elements as multiple copies.
			wrapMarker: true, //whether to wrap the bound marker, too
			maxRadius: 20015086.5, //cap on radius
		}

		//apply defaults if they aren't in the options object
		for(var i in defaults) { if(typeof options[i] == "undefined") options[i] = defaults[i]; }

		this._position = L.latLng(position);
		this._options = options;

		this._addedToMap = false; //flag for whether we've added this to the map yet
	},

	//remove all parts from map
	remove: function() {
		if(this._polygon) this._polygon.remove();
		if(this._circle) this._circle.remove();
		if(typeof this._circles != "undefined") {
			if(this._circles.length>0) {
				for(var i in this._circles) {
					this._circles[i].remove();
				}
			}
			this._circles = undefined;
		}
		this._addedToMap = false;
	},
	
	//add to the map
	addTo: function(map) {
		if(this._polygon) this._polygon.addTo(map);
		if(this._circle) this._circle.addTo(map);
		if(typeof this._circles != "undefined") {
			if(this._circles.length>0) {
				for(var i in this._circles) {
					this._circles[i].addTo(map);
				}
			}
		}
		this._addedToMap = true; //we keep track of this so we can automatically re-add new shapes if they switch
		this._map = map;
		this._map.on("zoomend", function() { this.redraw()},this); //refresh on zoom
		this.redraw(); //initial draw
	},
	
	//a function that binds the Great Circle object's LatLng to any other LatLng, based on an event firing
	bindTo: function(object, event="drag") {
		//moves with an object that has a LatLng
		this._bindobject = object;
		object.on(event, function(ev) {
			var ll = this._bindobject.getLatLng();
			var noredraw = (ll.lat==this._position.lat&&ll.lng==this._position.lng); //keeps this from redrawing when nothing has really changed -- otherwise redraw will fire twice on addMap and bindTo
			if(this._options.wrapMarker) {
				//"wraps" the marker if it exceeds bounds on low zooms
				if(this._map.getZoom()<=2) {
					if(ll.lng<-180) {
						ll.lng = 360+ll.lng;
						this._bindobject.setLatLng(ll);
					}
					if(ll.lng>180) {
						ll.lng = ll.lng-360;
						this._bindobject.setLatLng(ll);
					}
				}
			}
			if(!noredraw) this.setLatLng(this._bindobject.getLatLng());
		},this);
		object.fire(event);
	},
	
	//just to avoid re-calculating these ten million times
	_deg2rad: Math.PI / 180, _rad2deg: 180 / Math.PI,
	_m2km: 1/1000, //I know this is kind of obvious, but I'm just using it to improve legibility of code logic
	
	//set the latLng center of the Great Circle	
	setLatLng: function(position) {
		this._position = L.latLng(position);
		this.redraw();
	},
	
	//return the latLng center of the Great Circle
	getLatLng: function() {
		return this._position;
	},

	//update styles
    setStyle: function(options) {
		if(this._polygon) this._polygon.setStyle(options);
		if(this._circle) this._circle.setStyle(options);
		if(typeof this._circles != "undefined") {
			if(this._circles.length>0) {
				for(var i in this._circles) {
					this._circles[i].setStyle(options);
				}
			}
		}
    },
    
	//returns the bounds	
	getBounds: function() {
		if(this._circle) {
			return this._circle.getBounds(); //straightforward
		}
		if(this._polygon) {
			//this gives pretty good results for all of the clip statuses, even the weird ones
			return L.latLngBounds(
				this._destination_from_bearing(this._position.lat,this._position.lng,315,this._options.radius*this._m2km),
				this._destination_from_bearing(this._position.lat,this._position.lng,135,this._options.radius*this._m2km)
			);
		} 

		//if you don't have a circle or polygon, then I don't really know what you want. but here's something.		
		return L.latLngBounds(
			this._destination_from_bearing(this._position.lat,this._position.lng,315,this._options.radius*this._m2km),
			this._destination_from_bearing(this._position.lat,this._position.lng,135,this._options.radius*this._m2km)
		);
	},
	
	//set the radius of the Great Circle
	setRadius: function(radius) {
		this._options.radius = radius;
		if(this._options.maxRadius != -1) {
			if(this._options.radius > this._options.maxRadius) this._options.radius = this._options.maxRadius;
		}
		this.redraw();	
	},

	//return the radius
	getRadius: function() {
		return this._options.radius;
	},

	//a rounding function with decimal precision, which is necessary for the next function.
	_round: function(number,decimals = 0) {
		if(decimals==0) return Math.round(number);
		var multiplier = Math.pow(10, decimals);
  		return Math.round(number * multiplier) / multiplier;
	},

	//returns destination lat/lon from a start point lat/lon of a giving bearing (degrees) and distance (km).
	//round_off will round to a given precision. 
	//based on the haversine formula implementation at: https://www.movable-type.co.uk/scripts/latlong.html
	_destination_from_bearing: function(lat,lng,bearing,distance,round_off = undefined) {
		var R = 6371; // mean radius of the Earth, in km
		var d = distance;
		var deg2rad = this._deg2rad; var rad2deg = this._rad2deg;
		var lat1 = deg2rad*lat;
		var lng1 = deg2rad*lng;
		var brng = deg2rad*bearing;
		//kind of a sad attempt at optimization of these costly trig functions
		var sinLat1 = Math.sin(lat1); var cosLat1 = Math.cos(lat1);
		var cosdR = Math.cos(d/R); var sindR = Math.sin(d/R);
		var lat2 = Math.asin(sinLat1*cosdR+cosLat1*sindR*Math.cos(brng));
		var lng2 = lng1+Math.atan2(Math.sin(brng)*sindR*cosLat1,cosdR-sinLat1*Math.sin(lat2));
		if(typeof round_off != "undefined") {
			return [this._round(rad2deg*lat2,round_off),this._round(rad2deg*lng2,round_off)];
		} else {
			return [(rad2deg*lat2),(rad2deg*lng2)];
		}
	},

	//main render event -- the big show
	redraw: function() {

		var lat = this._position.lat; var lng = this._position.lng; //just for legibility
		if(this._options.maxRadius != -1) {
			if(this._options.radius > this._options.maxRadius) this._options.radius = this._options.maxRadius;
		}

		//These are control points that we can evaluate to see if it is clipping against the poles.
		//l1 and l2 are the top of the circle, l3 and l4 are the bottom.
		//In a closed circle, l1==l2 and l3==l4. In a clipped circle, one or both of these
		//conditions will not be true. Rounding used to deal with precision errors.
		var l1 = this._destination_from_bearing(lat,lng,0,this._options.radius*this._m2km, 3);
		var l2 = this._destination_from_bearing(lat,lng,360,this._options.radius*this._m2km, 3);			
		var l3 = this._destination_from_bearing(lat,lng,180,this._options.radius*this._m2km, 3);
		var l4 = this._destination_from_bearing(lat,lng,-180,this._options.radius*this._m2km, 3);
		
		//now check for the 4 possible clipping conditions
		if( (l1[0]!=l2[0]||l1[1]!=l2[1]) && (l3[0]!=l4[0]||l3[1]!=l4[1]) ) {
			this._clipStatus = 4; //both the top AND bottom of the circle is clipped (which means that there will be "holes" in the polygon) -- most complex case
		} else if( l1[0]!=l2[0]||l1[1]!=l2[1]) {
			this._clipStatus = 2; //top of the circle is clipped (moderately complex polygon)
		} else if( l3[0]!=l4[0]||l3[1]!=l4[1]) {
			this._clipStatus = 3; //bottom of the circle is clipped (moderately complex polygon)
		} else {
			this._clipStatus = 1; //no clipping at all (the circle is closed)
		}

		//figure out how many copies to render.
		//copies are copies to the left AND right of the main instance.
		//so 1 copy is 3 instances. 2 copies is 5. 0 copies is just the main instance.
		//for zooms 0-2, it tries to guess based on the pixels (which depends on browser zoom). for >2, just assumes 1 is OK. 
		switch(this._map.getZoom()) {
			case 0: 
				this._copies = Math.ceil((window.innerWidth / 256) /4)+2; 
			 break;
			case 1:
				this._copies = Math.ceil((window.innerWidth / 512) /4)+2; 
			 break;
			case 2:
				this._copies = Math.ceil((window.innerWidth / 768) /4)+1; 
			break;
			default: this._copies = 1; break;
		}
		//see if options override the above
		if(this._options.maxCopies > -1) this._copies = this._copies>this._options.maxCopies?this._options.maxCopies:this._copies;
		if(this._options.wrapElements === false) this._copies = 0;

		//now we see if we're rendering a polygon or a circle. there are several conditions that result in the polygon being preferred. it is also possible to override this with the clipLat setting.
		if((this._options.radius>=this._options.clipRad || this._clipStatus>1 || l1[0] >= this._options.clipLat || l3[0] <= this._options.clipLat*-1 || this._options.clipLat===false) && this._options.clipLat!==true) {
			//polygon is being rendered
			
			//initialize arrays of points
			this._latLngs = []; //array of lat/lngs for polygon
			this._latLngsM = []; //array for multipolygons
						
			//for each of the possible clipping scenarios, we draw the circles differently. this aids in assembling the polygons into coherent shapes that can be 
			//seamlessly joined together.
			//the basic algorithm draws the circles in two halves (the reason for this is because of complex clipStatus = 4, which requires putting the halves into different polygons).
			//the numbers below give two pieces of information for each half: what angle (degree) to start at, what angle to draw until. direction of movement through the start/stop is then inferred.
			//in the clipping cases, it also adds an additional point at the beginning of the polygon (the "lower" or "upper" edge).
			switch(this._clipStatus) {
				case 1: //perfect circle -- easy
					var t_start1 = 0; var t_stop1 = 180;  
					var t_start2 = 180; var t_stop2 = 360;  
				break;
				case 2: //top clipping -- work backwards
					var t_start1 = 360; var t_stop1 = 180; 
					var t_start2 = 180; var t_stop2 = 0;
					this._latLngs.push([90,l2[1]+(360*(-1*this._copies))]);
				break;
				case 3: //bottom clipping -- works best as -180 to 180
					var t_start1 = -180; var t_stop1 = 0; 
					var t_start2 = 0; var t_stop2 = 180;
					this._latLngs.push([-90,l4[1]+(360*(-1*this._copies))]);						
				break;
				case 4: //weird case 4 -- also works bet as -180 to 180
					var t_start1 = -180; var t_stop1 = 0; 
					var t_start2 = 0; var t_stop2 = 180; 
					this._latLngs.push([-90,l4[1]+(360*(-1*this._copies))]);						
				break;
			}
			//infer direction
			if(t_start1<t_stop1) { var t_dir1 = 1; } else { var t_dir1 = -1; }
			if(t_start2<t_stop2) { var t_dir2 = 1; } else { var t_dir2 = -1; }

			//now we render the circles. we do this for each of the copies.
			for(var copy=this._copies*-1;copy<=this._copies;copy++) {
				//iterate over polygon, using geo function to get lat/lng points, for the first half of the circle
				for(var theta=t_start1;  t_dir1>0?(theta < t_stop1):(theta > t_stop1);  theta+=(this._options.degStep*t_dir1)) {
					var ll = this._destination_from_bearing(lat,lng,theta,this._options.radius*this._m2km);
					ll[1] = ll[1]+(360*copy);
					this._latLngs.push(ll);
				}

				//special actions for weird clipStatus = 4 -- this pushes the points around so they form better polygons (a big polygon in the 0 array, and the rest are "holes")
				//the logic of this is basically: for the very far left copy (copy = -copies), it adds a bottom "edge" and then kicks it to the 0 position of _latLngsM.
				//for the middle copies, it puts the "left" half of the circle into the _latLngM array created by the previous copy, where it becomes the "right" side of a hole.
				//for the last, far-right copy (copy = copies), it preps the last part of the circle by adding a control point.
				if(this._clipStatus==4) {
					var ll = this._destination_from_bearing(lat,lng,360,this._options.radius*this._m2km);
					this._latLngs.push([ll[0],ll[1]+(360*copy)]);
					if(copy==this._copies*-1) {
						var ll = this._destination_from_bearing(lat,lng,-180,this._options.radius*this._m2km);
						this._latLngs.push([90,ll[1]+(360*(-1*this._copies))]);
						var ll = this._destination_from_bearing(lat,lng,180,this._options.radius*this._m2km);
						this._latLngs.push([90,ll[1]+(360*(-1*this._copies))]);
						this._latLngsM.push(this._latLngs);
					} else {
						this._latLngsM[this._latLngsM.length-1] = this._latLngsM[this._latLngsM.length-1].concat(this._latLngs);
					}
					this._latLngs = [];
					if(copy==this._copies) {
						var ll = this._destination_from_bearing(lat,lng,0,this._options.radius*this._m2km);
						this._latLngs.push([90,ll[1]+(360*(1*this._copies))]);
					}
				}
				
				//draw second half of the circle
				for(var theta=t_start2;  t_dir2>0?(theta < t_stop2):(theta > t_stop2);  theta+=(this._options.degStep*t_dir2)) {
					var ll = this._destination_from_bearing(lat,lng,theta,this._options.radius*this._m2km);
					ll[1] = ll[1]+(360*copy);
					this._latLngs.push(ll);
				}

				//again process for the clipstatus = 4 situation. in this case, if it is the last copy (copy = copies), we add a final control point and then push it into _latLngsM[0], where it is now
				//part of a giant polygon with the far left control point. For any other case, we create a new _latLngsM array of points, where this "right" side of a circle will be coupled with the "left" of the next copy.
				//again, the logic of this is confusing, but it makes sense if you graph it out: we have made a giant polygon, and used the other points to define coherent "holes" in the polygon.
				//the array pushing and concatenation is a way to juggle all this. 
				if(this._clipStatus==4) {
					var ll = this._destination_from_bearing(lat,lng,180,this._options.radius*this._m2km);
					this._latLngs.push([ll[0],ll[1]+(360*copy)]);
					if(copy==this._copies) {
						var ll = this._destination_from_bearing(lat,lng,180,this._options.radius*this._m2km);
						this._latLngs.push([-90,ll[1]+(360*(1*this._copies))]);						
						this._latLngsM[0] = this._latLngsM[0].concat(this._latLngs);
					} else {
						this._latLngsM.push(this._latLngs);
					}
					this._latLngs = [];
				}
				
				//for the non-clipping case, we push each coherent circle to a multipolygon so lines don't connect the disconnected bits
				if(this._clipStatus==1) { 
					if(typeof this._latLngsM == "undefined") this._latLngsM = [];
					this._latLngsM.push(this._latLngs);
					this._latLngs = [];
				}
			}

			//now that we're done, there are still a few final control points that need to be added in two of the cases (top and bottom)
			switch(this._clipStatus) {
				case 2: 
					var ll = this._destination_from_bearing(lat,lng,0,this._options.radius*this._m2km);
					this._latLngs.push([ll[0],ll[1]+(360*(this._copies))]);
					this._latLngs.push([90,ll[1]+(360*(this._copies))]);
				break;
				case 3:
					var ll = this._destination_from_bearing(lat,lng,180,this._options.radius*this._m2km);
					this._latLngs.push([ll[0],ll[1]+(360*(this._copies))]);
					this._latLngs.push([-90,ll[1]+(360*(this._copies))]);
				break;				
			}
			
			//now we render the latLng points we've generated for the polygons. 

			//if there was a circle (or circles) previously, get rid of it
			if(this._circle) {
				this._circle.remove(); 
				this._circle = undefined;
				if(typeof this._circles != "undefined") {
					if(this._circles.length>0) {
						for(var i in this._circles) {
							this._circles[i].remove();
						}
					}
					this._circles = undefined;
				}
			}
			
			//create, or update, the existing polygon object
			if(!this._polygon) { //create new
				if(this._clipStatus == 1 || this._clipStatus == 4) { //multipolygon
					this._polygon = new L.polygon(this._latLngsM,this._options);
				} else { //render single polygon
					this._polygon = new L.polygon(this._latLngs,this._options);
				}
				if(this._addedToMap) { //if it's added to the map already, add it to the map. I guess I can imagine cases where you might want to calculate it but not render it to a map, like maybe you want to do something to the LatLng points before rendering them? Anyway, I give you the option.
					this._polygon.addTo(this._map);
				}
			} else { //update exiting
				if(this._clipStatus == 1 || this._clipStatus == 4) { //multipolygon
					this._polygon.setLatLngs(this._latLngsM);				
				} else {
					this._polygon.setLatLngs(this._latLngs);
				}
				this._polygon.setStyle(this._options);
				this._polygon.redraw();
			}
		} else {
			//if we aren't rendering a polygon, we're rendering a "normal" circle object

			//if there was a polygon previously, get rid of it
			if(this._polygon) {
				this._polygon.remove();
				this._polygon = undefined;
			}
			
			//copy management 
			if(this._copies>0) {
				if(typeof this._circles == "undefined") {
					this._circles = [];
				} else if(this._circles.length > (this._copies*2)) { //this trims any copies off we don't need
					for(var i in this._circles) {
						if(i>this._copies*2) {
							this._circles[i].remove();
						}
					}
				}
			}  else {
				if(typeof this._circles != "undefined") {
					if(this._circles.length>0) {
						for(var i in this._circles) {
							this._circles[i].remove();
						}	
					}
				}
				this._circles = undefined;
			}
			//now we render the circles. we do this for each of the copies, too.
			for(var copy=this._copies*-1;copy<=this._copies;copy++) {
				if(copy==0) { //main instance
					if(!this._circle) { //create new circle object
						this._circle = new L.circle(this._position,this._options);
						if(this._addedToMap) { //add to map if it should be
							this._circle.addTo(this._map);
						}
					} else { //update existing
						this._circle.setLatLng(this._position);
						this._circle.setStyle(this._options);
						this._circle.setRadius(this._options.radius);
						this._circle.redraw();
					}
				} else { //create or update copy
					if(typeof this._circles[copy] == "undefined") {
						this._circles[copy] = new L.circle([lat,lng+(360*copy)],this._options);
						if(this._addedToMap) { //add to map if it should be
							this._circles[copy].addTo(this._map);
						}
					} else {
						this._circles[copy].setLatLng([lat,lng+(360*copy)]);
						this._circles[copy].setStyle(this._options);
						this._circles[copy].setRadius(this._options.radius);
						this._circles[copy].redraw();
					}
				}			
			}

		}
	}
});

L.greatCircle = function(position, options) {
	return new L.GreatCircle(position, options);
};
