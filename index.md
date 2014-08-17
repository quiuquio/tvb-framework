<script type="text/javascript" src="http://d3js.org/d3.v3.min.js" charset="utf-8"></script>
<script type="text/javascript" src="javascripts/jquery.js" charset="utf-8"></script>
<script type="text/javascript" src="javascripts/jqueryui.js" charset="utf-8"></script>
<script type="text/javascript" src="javascripts/timeseriesFragment.js" charset="utf-8"></script>
<script type="text/javascript" src="javascripts/rainbowvis.js" charset="utf-8"></script>

### What is this about? 

Hi all, my name is Robert Parcus and I'm a CS student
from UNIPG (Italy). I'm moving to Hong Kong this September to further my studies
and my plan for the Summer of 2014 was to participate in this year's [Google
Summer Of Code](https://www.google-melange.com/gsoc/homepage/google/gsoc2014).

Gladly, I was accepted as a student in this amazing project and here I would
like to spend a few words about the whole experience. Going from the application
phase up to the finishing days. I hope you will enjoy the journey as much as I
did.

### The Application Phase

After browsing the list of accepted organizations, I quickly decided that I
wanted to apply for one of [INCF](http://incf.org)'s  13
[projects](http://incf.org/gsoc).  I started to read about them and even if I
didn't know anything about The Virtual Brain before, it really got stuck in my
head (pun intended).

[The Virtual Brain](http://thevirtualbrain.com/) is a set of tools for
simulating the human brain based on large scale connectivity. It can be used as
a Neuroscience scientific library for python or as a super cool framework,
complete with a web based user interface full of
[visualizers](http://docs.thevirtualbrain.org/basic/link_user_guide.html#time-
series-volume-visualizer).

Here is a small video about The Virtual Brain.
[![The Virtual Brain Video](http://img.youtube.com/vi/RZgULkLKqu8/0.jpg)](https://www.youtube.com/watch?v=RZgULkLKqu8)

### My Mentors

Mentors are the links between us students and the organizations we are
working with.

Even before GSoC begins, students are advised to contact their hosting
organizations to discuss about their working proposals. Since I didn't know TVB
beforehand, I wrote them as soon as I could and to my surprise they replied
back! :)

From my point of view, the people working on The Virtual Brain were like super
stars and to see that we could exchange ideas, just like that, was a great thing
for me. They had an advice for every and each one of my doubts, and they helped
me not only in the application phase but also during my three months of work on
GSoC, when they were always ready to help me polish my code and make good
suggestions.

@liadomide (Lia Domide) and @pausz (Paula Sanz-Leon) were my mentors during this
GSoC and I'm really thankful for all their time, patience and expertise. It is a
pleasure knowing them.

Also I must thank @maedoc (Marmaduke Woodman) who was not officially my mentor
but gave a great hand during all the process.

If I were to say which was the hardest part of GSoC. I'd say that it was
definitely the application part.

After a lot of thinking and talking with my mentors, the application deadline was
almost coming and I decided to send Google my proposal.

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
planning for  a project this big and I learned a lot during the process. Again,
a big help came from my mentors who always had good suggestions ready.

### Wating for results

Well, I would love to say that I simply waited and crossed my fingers, but no.
I was really nervous about the outcome of the selection process and I remember that
I also sent some of my stress to my mentors: 
*"Is the application good enough?", "Should I have changed [...] to [...]?",
"Should I have added more features to the proposal?", etc*.
At this point, a well placed "Don't worry" from them was really helpful. :)

### On being Accepted

I just want to leave a small note about this, since the overall sensation of a
successful application should be obvious to everyone already:

It is hard to describe how happy I was when I read my name among the selected
students. Google-melange sent me a few emails, the INCF started tweeting about
it. I was added to the GSoC students mailing list where more than a thousand
students from all over the world were talking about their experiences and
asking for advice from other students (also, a lot of spam!). I suddenly had
to (re-)read a lot of related documents, FAQs, emails. It was overwhelming!

I then proceeded to tweet about it myself and share some links on G+, but at
first I did so on a very timid fashion.

I only really talked about GSoC in detail to a few close friends and colleagues.
Before everything really started, I feared that the adventure was too big for me
to handle and if I were to fail, I would want people to know as little as
possible about it. It turns out that this was nothing but a silly behavior.

The more they know about what you do, the more your friends can support and
understand you, in good or bad times.

The next time that someone calls me out for a movie or similar things I won't
just say that I'm busy or come up with general excuses. I will probably be
specific and just say the truth:

_"Sorry, I have to work on a neuroscience data
visualization thing and I'm really into it. Maybe next week? :)"_

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
A little delay was expected in these cases but we noticed that it consisted of a
negligible wait for average resolution data. As soon as the user stops picking,
we can resume playback again, together with the buffering of future data based
on the new selected voxel.

Coupled with the buffering system, a safety procedure was put in place 
to keep the memory footprint always under a certain threshold.

### Time Series Fragment Visualizer

After the completion of the Volumetric Time Series Visualizer, we decided to
focus on Time Series visualization.  The technology of choice was
[D3.js](www.d3js.org) and at the end of the project the result was similar to
this:

```javascript
/**
 * Click on the graph to interact with it. This is a dumbed down version of the
 * new TVB Time Series Visualizer that I hacked on this page.
 *
 * It's displaying random data.
 * 
 * Click on the colored lines to sort them and move the brush in the middle to
 * focus on a specific area of the time series.
 */
```

<div id="ts-graph-parent">
    <div id="graph" class="aGraph"></div>
</div>

<script type="text/javascript">
    $(function(){
        TSF_initVisualizer();
        drawGraphs()
    })
</script>

A better description of how this visualizer works can be seen in the TVB
documentation and for some cool (at least for me) insider information about it,
you can take a look at this [now closed pull request on the TVB github
repository](https://github.com/the-virtual-brain/tvb-framework/pull/12). 

![Time Series Fragment](https://raw.githubusercontent.com/quiuquio/tvb-framework/gh-pages/images/tvbPost/third.jpg "Time Series Fragment")

In the last days of the project, I restyled the visualizer and cleaned the code
to a point were I felt it was ready to belong to an open source project.

All the code can now be seen on [The Virtual Brain's github
repositories](https://github.com/the-virtual-brain).

The final result looks like this: 

![Final Result](https://raw.githubusercontent.com/quiuquio/tvb-framework/gh-pages/images/tvbPost/fourth.png "Final Result")


#Final Thoughts

After more than three months of work Google Summer of Code 2014 has finished.
I'm glad that I could open this chapter in my life and I'm also glad that
it added many novelties to my story. I hope that I will be able to collaborate
again with the folks at The Virtual Brain and I'm also thankful to my loved ones
who gave me a lot of support during the last months (as they always did
actually). Thanks!

If I must give a two words advice about GSoC to all my fellow students, it is
the following:

**Do it.**

Really, just do it. Don't be afraid to push your limits. A lot of great things
are waiting just outside your comfort zone.

Thanks for reading this,
Robert Parcus 2014

---

Now, after I'm done sounding like I'm a Nike advertiser, if you think that this
page is missing some information, or you simply want to chat about anything,
you can find me at betoparcus@gmail.com.

