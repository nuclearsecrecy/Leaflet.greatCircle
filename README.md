# Leaflet.greatCircle.js

Leaflet.greatCircle.js is a plugin for [Leaflet.js](https://leafletjs.com/) created by [Alex Wellerstein](http://blog.nuclearsecrecy.com) in 2018, licensed under the [MIT License](https://opensource.org/licenses/MIT).

This is a wrapper class for the Leaflet.js Polygon object that draws it as a great circle (i.e., showing true spherical paths) rather than a perfect circle that gets highly distorted at the poles or when rendered with a very large radii on the web Mercator projection. I made this because Leaflet's Circle class doesn't render correctly near the poles or at very large radii. Why would one need such a thing? Because I wanted to port my missile range and accuracy website, [MISSILEMAP](https://nuclearsecrecy.com/missilemap), to Leaflet (and away from the financially ruinous Google Maps API).

Also has the advantage of "wrapping" the circle object around multiple copies of the map at low zoom levels, which no Leaflet.js objects currently support by default. 

**NOTE:** The wrapping will not work unless worldCopyJump is set to 'true' in the map object's options. It's up to you if you want to do this.

This class was designed explicitly to mimic the circle behavior used by Google Maps API, which includes:

* Geographically correct rendering of circle points (calculated using the [haversine formula](https://www.movable-type.co.uk/scripts/latlong.html))

* Proper "wrapping" at low zoom levels

* Proper handling of the strange-but-true appearances of "holes" (the small uncovered edges) of very-large radii

The main downsides of this plugin are that rendering does not always look as "smooth" as the pure Circle objects, and this is probably more computationally and memory intensive than a pure Circle object (because it is potentially calculating thousands of points each time it is redrawn). But for applications that require fidelity near the poles or with very large radii, it is a huge improvement. 

Note that has all of the same options as a Polygon or Circle object (depending on which is invoked), but does NOT have every method implemented -- if you  want to implement a method, look to the addTo and remove implementations to see how this ought to be done.

## Basic usage

In most cases you can just use this the same way as Leaflet's [Circle class](https://leafletjs.com/reference-1.3.4.html#circle), e.g.:

```
L.greatCircle([50.5, 30.5], {radius: 200});
L.greatCircle.addTo(map);
```

The first parameter is a latlng (either a Leaflet latLng object, or an array of lat,lng), the second parameter is an object of options.

## Example

See the **[example page](https://nuclearsecrecy.github.io/Leaflet.greatCircle/example/)** for a full demo, but here is a basic real-life usage with both a greatCircle and a bound Marker:

```
function init() {
	//load leaflet map 
	map = L.map('map', {
		center: [21,5.7],
		zoom: 1,
		worldCopyJump: true //this is necessary for the wrapping effect to work!!
	})

	//load OpenStreetMap map tiles
	var osmUrl = 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
		osmAttrib = '&copy; <a href="http://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
		osm = L.tileLayer(osmUrl, {attribution: osmAttrib, });
	osm.addTo(map);

	//create the marker
	marker = new L.marker(map.getCenter(),{
		draggable: true,
		autoPan: true 
	}).addTo(map);

	var radius = 10000000; //10,000 km 
	//initialize the greatCircle object
	gc = new L.greatCircle(marker.getLatLng(), {
		radius: radius,
	});
	gc.addTo(map); //add to map
	gc.bindTo(marker); //bind to marker
}
```

## Options

Along with the normal options used by the L.Circle and L.Polygon classes (which are passed on to the rendered objects), the following unique options are supported:

**clipLat** _Number_

If a number, is the +/- latitude that designates when a L.Polygon object is rendered, versus a L.Circle object. The idea here is that for many usages you could have this work as a "true" Circle (which looks nicer) and only use the Polygon
rendering mode for cases where you thought the Circle would clip. So if you used, say, 65 as the clipLat, any object of this class
that has a latitude that is <=-65, or >=65, will be rendered as a Polygon. Otherwise, a Circle will be rendered. Note that if the
class detects that definite clipping has occurred (e.g., the circle has "broken"), it will render as a Polygon with this setting.
This is not a fool-proof method, though, since there can be considerable distortion even at lesser latitudes (even 0) if the radius
is large enough, and without the circle "breaking." If instead 'true' (Boolean) is passed in this parameter, it will *always* render
as a Circle object. If 'false' is passed, it will *always* render as a Polygon. Defaults to '65.'

**clipRad** _Number_

The radius (in meters) at or above which it will always render a polygon, unless clipLat == true. Setting to 0 is the same as 
setting clipLat to 'false'.

**degStep** _Number_ 

A number that indicates the degrees by which the rendering of the circle is stepped forward when rendered as a Polygon. E.g., if 1, then there will be ~360 points comprising each Polygon. If 2, then it is ~180 points. If 0.5, then ~720. Note that the uncertainty in number of points is because a few "extra" points are typically added, to guarantee smooth closures of the rendered Polygons no matter how many steps they have. (So you can technically even set this to 0, but it looks terrible.) Defaults to 0.5.

**wrapElements** _Boolean_

Boolean value that indicates whether efforts should be made to "wrap" the Polygon or Circle objects around the globe. This is accomplished in the case of the Polygon by adding additional Lat/Lng points, and in the case of the Circle by adding duplicate objects that are re-drawn whenever the main object is redrawn. Setting this to "false" will mean that only one GreatCircle object is ever rendered. Copies are only created for map zoom levels 0-2 (they don't seem necessary for further levels). Default to "true".

**maxCopies** _Number_ 

When wrapElements is "true", this number defines the upper limit on wrapped copies that are created. If set to -1, the number of copies is set automatically based on the zoom level and the browser's reported innerWidth property of the map element, which seems to usually work fine though it probably creates more copies than are strictly necessary at times. If you are worried about performance or memory, you can cap the maximum number of copies. Note that the number of copies defines how many copies there are on each side of the "primary" drawn element. So setting this to 1 means there will be three total elements rendered. Setting it to 2 will mean there are 5. Setting it to 0 is the equivalent of setting wrapElements to 'false': it will only render the main element. Defaults to -1 (class decides how many to produce). 

**wrapMarker** _Boolean_

If you use the bindTo method (see below), it will automatically "wrapping" the marker (or whatever object) if it exceeds lng = 180/-180 on low zooms (0-2) and this is set to 'true'. Default is 'true.'

**maxRadius** _Number_

The maximum number a radius can be set to. Default is a huge number (20015086.5 m) which appears to be the limit at which the polygons can be correctly rendered. Set to -1 for no max radius.

## Methods

Methods from L.Circle and L.Polygon that are supported (at least in their standard implementations) include:

* addTo()
* getBounds()
* getLatLng()
* getRadius()
* on()
* redraw()
* remove()
* setLatLng()
* setRadius()
* setStyle()

The unique methods supported are:

**bindTo** _object_, _event (String)_ 

Binds that latLng position of the center of the GreatCircle object to the latLng position of the object, synchronizing it whenever the object's event listener fires. By default, event is "drag." This was developed to make it easier to bind GreatCircles  to markers, but you could do other things with it too, I guess. I was just surprised Leaflet did not have an automatic way to do this. Note that this will also wrap the marker (or whatever you bind it to) if wrapMarker is set to 'true'.
