//-------------------------------------------------
//
//	skGraphicsManager
//
//-------------------------------------------------

function skGraphicsManager() {

    this._dispElements = [];
	
	// set up paper with canvas
	//
	paper.install(window);
	paper.setup('drawing_canvas');

	// set up mouse event
	//
	var tool = new Tool();

	tool.onKeyDown = function (event) {
	    var command;
	    if (Key.isDown('escape')) {
	        command = new skSelectGeomCommand();
	    }
	    rnController.setActiveCommand(command);
	}

	tool.onMouseDown = function (event) {
	    rnController.activeCommand().onMouseDown(event);
	}
	
	tool.onMouseDrag = function (event) {
	    rnController.activeCommand().onMouseDrag(event);
	}
	
	tool.onMouseUp = function (event) {
	    rnController.activeCommand().onMouseUp(event);
	}

    // graphics manager methods
    //
	this.dispElements = function () {
	    return this._dispElements;
	}

	this.addDispElement = function (dispElement) {
	    this._dispElements.push(dispElement);
	}
}

//-------------------------------------------------
//
//	data type conversion utilities
//
//-------------------------------------------------

var skConv = new (function () {
    this.toPaperPoint = function (mpt) {
        return new Point(mpt.x(), mpt.y());
    }

    this.toPaperRect = function (mrect) {
        return new Rectangle(this.toPaperPoint(mrect.topLeft()), this.toPaperPoint(mrect.bottomRight()));
    }

    this.toMathPoint = function (pt) {
        return new skMPoint(pt.x, pt.y);
    }

    this.toMathRect = function (rect) {
        return new skMRectangle(rect.topLeft, rect.bottomRight);
    }
});


//-------------------------------------------------
//
//	skDispElement
//
//-------------------------------------------------

function skDispElement(element) {
    this._isSelected = false;
    this._skElement = element;
    this._pathItem = null;
    this._boundingBox = null;

    this.skElement = function () {
        return this._skElement;
    }

    this.pathItem = function() {
        return this._pathItem;
    }

    this.boundingBox = function () {
        if (!this._boundingBox) {
            this._boundingBox = new skBoundingBox(this);
        }
        return this._boundingBox;
    }

    this.setIsSelected = function (b) {
        this._isSelected = b;
        this.boundingBox().setVisible(b);
    }

    this.isSelected = function () {
        return this._isSelected;
    }

    this.init = function () {
        var pathItem = this._pathItem;
        var skelement = this._skElement;
        if (pathItem) {
            pathItem.strokeColor = skelement.strokeColor();
            pathItem.fillColor = skelement.fillColor();
            pathItem.strokeWidth = skelement.strokeWidth();
            pathItem.dispElement = this;        // add a property to Paper.js's pathItem object
        }

        skelement.addListener(this);
    }

    this.notify = function (event) {
        if (event.message = "geometry moved") {
            var delta = new Point(event.dx, event.dy);
            this._pathItem.translate(delta);
            if (this._boundingBox)
                this._boundingBox.translate(delta);
        }
    }
}

//-------------------------------------------------
//
//	skDispLineSegment
//
//-------------------------------------------------

function skDispLineSegment(lnSeg) {
    skDispElement.call(this, lnSeg);

    var pt1 = skConv.toPaperPoint(lnSeg.geom().startPt());
    var pt2 = skConv.toPaperPoint(lnSeg.geom().endPt());

    this._pathItem = new Path.Line(pt1, pt2);
    this.init();
}

skDispLineSegment.prototype = new skDispElement();

//-------------------------------------------------
//
//	skDispOval
//
//-------------------------------------------------

function skDispOval(oval) {
    skDispElement.call(this, oval);

    var rect = skConv.toPaperRect(oval.geom().rect());
    var b = oval.geom().circum();

    this._pathItem = new Path.Oval(rect, b);
    this.init();
}

skDispOval.prototype = new skDispElement();

//-------------------------------------------------
//
//	skBoundingBox: a group of path items forming the bounding box of the input path
//
//-------------------------------------------------

function skBoundingBox(dispElement) {

    var items = [];
    var sz = 8;
    var r = sz / 2;

    var pathItem = dispElement.pathItem();
    var skelement = dispElement.skElement();

    if (skelement.geomType() === kLineSegment) {
        var startPt = new Path.Circle(pathItem.firstSegment.point, r);
        var endPt = new Path.Circle(pathItem.lastSegment.point, r);
        items.push(startPt);
        items.push(endPt);

        this._itemsGroup = new Group(items);
        this._itemsGroup.style = {
            fillColor: '#C5E6EA',
            strokeColor: '#385D8A',
            strokeWidth: 1
        };
    }
    else {
        // calculate point positions
        //
        var rect = pathItem.bounds;
        var tl = rect.point;
        var tr = tl.add(rect.width, 0);
        var ll = tl.add(0, rect.height);
        var lr = tl.add(rect.width, rect.height);

        var leftmid = tl.add(0, rect.height / 2);
        var lowmid = ll.add(rect.width / 2, 0);
        var rightmid = tr.add(0, rect.height / 2);
        var topmid = tl.add(rect.width / 2, 0);

        var handleLength = 20;
        var handledown = topmid;
        var handleup = handledown.add(0, -handleLength);

        // create paths
        //
        var leftEdge = new Path.Line(tl, ll);
        var lowEdge = new Path.Line(ll, lr);
        var rightEdge = new Path.Line(lr, tr);
        var topEdge = new Path.Line(tr, tl);
        var handleEdge = new Path.Line(handledown, handleup);

        var tlCorner = new Path.Circle(tl, r);
        var trCorner = new Path.Circle(tr, r);
        var llCorner = new Path.Circle(ll, r);
        var lrCorner = new Path.Circle(lr, r);
        var handleUp = new Path.Circle(handleup, r);

        var leftMid = new Path.Rectangle(leftmid.x - r, leftmid.y - r, sz, sz);
        var lowMid = new Path.Rectangle(lowmid.x - r, lowmid.y - r, sz, sz);
        var rightMid = new Path.Rectangle(rightmid.x - r, rightmid.y - r, sz, sz);
        var topMid = new Path.Rectangle(topmid.x - r, topmid.y - r, sz, sz);

        items.push(leftEdge);
        items.push(lowEdge);
        items.push(rightEdge);
        items.push(topEdge);
        items.push(handleEdge);
        items.push(tlCorner);
        items.push(trCorner);
        items.push(llCorner);
        items.push(lrCorner);
        items.push(handleUp);
        items.push(leftMid);
        items.push(lowMid);
        items.push(rightMid);
        items.push(topMid);

        this._itemsGroup = new Group(items);
        this._itemsGroup.style = {
            fillColor: '#C5E6EA',
            strokeColor: '#385D8A',
            strokeWidth: 1
        };

        handleUp.fillColor = '#8BE73D';
    }

    this.setVisible = function (b) {
        this._itemsGroup.visible = b;
    }

    this.translate = function (delta) {
        this._itemsGroup.translate(delta);
    }
}

