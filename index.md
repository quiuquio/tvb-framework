<script type="text/javascript" src="http://d3js.org/d3.v3.min.js" charset="utf-8"></script>
<script type="text/javascript" src="https://raw.githubusercontent.com/quiuquio/tvb-framework/gh-pages/javascripts/timeseriesFragment.js" charset="utf-8"></script>
### What is this about? 

Hi all, my name is Robert Parcus and I'm a CS student
from UNIPG (Italy). I'm moving to Hong Kong this September to further my studies
and my plan for the Summer of 2014 was to participate in this year's [Google
Summer Of Code](https://www.google-melange.com/gsoc/homepage/google/gsoc2014).

Gladly, I was accepted as a student in this amazing project and here I would
like to spend a few words about the whole experience. Going from the application
phase up to the finishing days. I hope you will enjoy the journey as much as I
did.

### The Application Phase:
After browsing the list of accepted organizations, I quick

### Volumetric Time series visualizer for TVB and updating other visualization tools

This was the final title of my proposal. From the Google-melange website:
>**Organization:** International Neuroinformatics Coordinating Facility

>**Assigned mentors:** Lia Domide, Paula Sanz-Leon

>**Short description:** The main goal of this proposal is to implement a time-
series visualizer for 4D data in TVB, which would enable users to work with
their functional MRI data directly from the browser. Then I will work on
rewriting some of the visualizers that are currently implemented using
MatplotLib and MPLH5, backed with web-friendly tools.

The proposal itself was much bigger and specific than this. The whole
application phase was already a big challenge by itself. It was my first time
planning for  a project this big and I learned a lot during the process. A big
help came from my mentors who always had good suggestions ready for me and I
can't stress enough how much a good advice from your mentor can help you in a
tricky situation.


### About the Implementation
![The Visulizer Prototype](https://raw.githubusercontent.com/quiuquio/tvb-framework/gh-pages/images/tvbPost/first.png "The Visulizer Prototype")

We decided to work on an already implemented prototype. The basic features to
display the slices were already in place but the visualizer was missing its
playback  functionalities.

Also, since fMRI data can be huge, a buffering mechanism was necessary in order
to load the required information and display it as fast as possible on the
browser.

At first, I decided to give our visualizer a real user interface, so that I
could test it directly as a user would do, without having to rely only on the
console. The UI would also help display some information about the data being
visualized, like selected time point and coordinates. Moreover, I tried to
resize the quadrants and give each one of them a margin.

After playing around with the quadrants settings and using jQuery UI to create
the user interface I had something very basic, like this:
![First UI](https://raw.githubusercontent.com/quiuquio/tvb-framework/gh-pages/images/tvbPost/second.png "First UI")

Now, for the hard part, it was time to focus on the buffering and the playback
features.

My first attempt was to load everything in memory, but soon it was clear that
this was not a realistic approach. A compressed fMRI file can easily occupy
hundreds of Megabytes, hence loaded, uncompressed data could easily surpass the
Gigabyte mark.

For example, we had a 91x109x91 voxels test set which was 177 frames long. In
the client side the data would become a double-precision  array with
159765333 elements. Such a big javascript array is just an easy way to crash
your browser.

On the other hand, a purely lazy approach was also a bad solution: To query for
a single frame, wait for the server to prepare it, receive the json data and
parse it was either too slow or an overall waste of bandwidth, because of the
overhead of requesting only one frame at a time.

Also, even if AJAX calls can be made asynchronously, the playback and UI would
all freeze while waiting for the parsing operations.

To avoid blocking the main thread we used webworkes for parsing the json. An in-
line wrapper was used so that we didn't need to use a separate file for the
webworker code.

```javascript
function inlineWebWorkerWrapper(workerBody){
    var retBlob = URL.createObjectURL(
        new Blob([
            '(',
                workerBody.toString(),
            ')()' ],
        { type: 'application/javascript' }
        )
    );
    return retBlob;
}
```
While the parsing function was similar to:
```javascript
var parserBlob = inlineWebWorkerWrapper(
            function(){
                self.addEventListener( 'message', function (e){
                    // Parse JSON, send it to main thread, close the worker
                    self.postMessage(JSON.parse(e.data));
                    self.close();
                }, false );
            }
        );

function parseAsync(data, callback){
    var worker;
    var json;
    if( window.Worker ){
        worker = new Worker( parserBlob );
        worker.addEventListener( 'message', function (e){
            json = e.data;
            callback( json );
        }, false);
        worker.postMessage( data );
    }
    else{
        json = JSON.parse( data );
        callback( json );
    }
}
```

It is important to remember that this approach **will not** speed up the parsing
itself (it may even delay it). Its only benefit is that the main thread will
never freeze while waiting for the parsing to happen and during playback this
is exactly what we need.

With the parsing problem solved, the next thing was buffering.

The visualizer checks the selected voxel and asynchronously queries the server
for batches of frames of the three visible planes only. If our data is composed
of n sized MRI "cubes", this approach reduces the spatial complexity of each
frame from O(n^3) to O(n^2).

If the user clicks the planes to navigate in space, we halt the buffering of
future frames and synchronously load the complete cube data for that time point.
A little delay was expected in this cases but we noticed that it consisted of a
negligible wait for average resolution data. As soon as the user stops picking,
we can resume playback again, together with the buffering of future data based
on the new selected voxel.

Coupled with the buffering system, a safety procedure was put in place 
to keep the memory footprint always under a certain threshold.

### Time Series Fragment Visualizer

After the completion of the Volumetric Time Series Visualizer, we decided to
focus on Time Series visualization.  The technology of choice was
[D3.js](www.d3js.org) and at the end of the project the result was this:

![Time Series Fragment](https://raw.githubusercontent.com/quiuquio/tvb-framework/gh-pages/images/tvbPost/third.jpg "Time Series Fragment")


