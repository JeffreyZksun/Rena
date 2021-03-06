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
	this._drawingCanvas = document.getElementById('drawing_canvas');
	paper.setup(this._drawingCanvas);

	// set up mouse event
	//
	var tool = new Tool();

	tool.onKeyDown = function (event) {
	    if (Key.isDown('escape')) {
	        rnController.setActiveCommand(new skSelectGeomCommand());
	    }
	    else if (Key.isDown('r')) {
	        rnController.setActiveCommand(new skCreateRectangleCommand());
	    }
	    else if (Key.isDown('d')) {
	        rnController.setActiveCommand(new skCreateDimensionCommand());
	    }
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
	
	tool.onMouseMove = function (event) {
	    rnController.activeCommand().onMouseMove(event);
	}

    // graphics manager methods
    //
	this.dispElements = function () {
	    return this._dispElements;
	}

	this.addDispElement = function (dispElement) {
	    this._dispElements.push(dispElement);
	}
	
	this.drawingCanvas = function () {
	    return this._drawingCanvas;
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
        return new skMRectangle(this.toMathPoint(rect.topLeft), this.toMathPoint(rect.bottomRight));
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

    if (this._skElement)
        this._skElement.addListener(this);

    this.skElement = function () {
        return this._skElement;
    }

    this.pathItem = function() {
        return this._pathItem;
    }

    this.boundingBox = function () {
        return this._boundingBox;
    }

    this.setIsSelected = function (b) {
        this._isSelected = b;
		if (this.boundingBox() != null)
			this.boundingBox().setVisible(b);
    }

    this.isSelected = function () {
        return this._isSelected;
    }

    this.clonePathItemByBBox = function () {      // clone a path item using current BBox position/orientation
        return this.clonePathItem(this._boundingBox.defPt1(), this._boundingBox.defPt2());
    }

    this.setDrawingStyle = function (pathItem, skElement) {
        pathItem.style = {
            fillColor: skElement.fillColor(),
            strokeColor: skElement.strokeColor(),
            strokeWidth: skElement.strokeWidth()
        };
    }

    this.notify = function (event) {
        if (event.message = "geometry changed") {
            this.regenerate();   
        }
    }
    
    this.regenerate = function () {
        var oldPathItem = this._pathItem;
        var oldBoundingBox = this._boundingBox;
        
        this.init();

        if (oldPathItem) {
            this._pathItem.moveAbove(oldPathItem);  // this keeps the order of the path item
            oldPathItem.remove();
            oldPathItem = null;
        }

        if (oldBoundingBox) {
            oldBoundingBox.removePathItems();
            oldBoundingBox = null;
        }
    }
}

//-------------------------------------------------
//
//	skInvisibleCenterPoint
//
//-------------------------------------------------

function skInvisibleCenterPoint(pt, owningDispElement) {
    this._pathItem = new Path.Circle(pt, 4);
    this._pathItem.invisibleCenter = true;
    this._pathItem.dispElement = owningDispElement;
}


//-------------------------------------------------
//
//	skDispPoint
//
//-------------------------------------------------

function skDispPoint(pt) {
    skDispElement.call(this, pt);
    
    this.init = function () {
        var pt = this.skElement();
        var pt1 = skConv.toPaperPoint(pt.geom());

        this._pathItem = new Path.Circle(pt1, 4);
        this._pathItem.dispElement = this;
        this._boundingBox = null; //new skLineBounds(this);

        this.setDrawingStyle(this._pathItem, this.skElement());
		this._pathItem.style = {
			fillColor: '#C5E6EA',
			strokeColor: '#385D8A',
			strokeWidth: 1,
			opacity: 0.5
		};
    }

    this.clonePathItem = function (pt) {
        var tempPathItem = new Path.Circle(pt, 4);
        this.setDrawingStyle(tempPathItem, this.skElement());
        return tempPathItem;
    }
    
    this.getConstrainableGeometry = function (pathItem, point) {
		if (pathItem.dispElement) {			
			var pt = pathItem.position;
            return skConv.toMathPoint(pt);
        }        
        return null;
    }

    this.init();
}

skDispPoint.prototype = new skDispElement();

//-------------------------------------------------
//
//	skDispLineSegment
//
//-------------------------------------------------

function skDispLineSegment(lnSeg) {
    skDispElement.call(this, lnSeg);
    
    this.init = function () {
        var lnSeg = this.skElement();
        var pt1 = skConv.toPaperPoint(lnSeg.geom().startPt());
        var pt2 = skConv.toPaperPoint(lnSeg.geom().endPt());

        this._pathItem = new Path.Line(pt1, pt2);
        this._pathItem.dispElement = this;
        this._boundingBox = new skLineBounds(this);

        this.setDrawingStyle(this._pathItem, this.skElement());
    }

    this.clonePathItem = function (pt1, pt2) {
        var tempPathItem = new Path.Line(pt1, pt2);
        this.setDrawingStyle(tempPathItem, this.skElement());
        return tempPathItem;
    }
    
    this.getConstrainableGeometry = function (pathItem, point) {
        if (pathItem.owningBBoxElement) {
            var bboxElement = pathItem.owningBBoxElement;
            if (bboxElement instanceof skBBoxLineEndPt) {
                return skConv.toMathPoint(pathItem.position);
            }
        }
        else if (pathItem.dispElement) {
            var pt1 = pathItem.firstSegment.point;
            var pt2 = pathItem.lastSegment.point;
            return new skMLineSegment(skConv.toMathPoint(pt1), skConv.toMathPoint(pt2));
        }
        
        return null;
    }

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
    
    this.init = function () {
        var oval = this.skElement();
        var rect = skConv.toPaperRect(oval.geom().rect());
        var b = oval.geom().circum();

        this._pathItem = new Path.Oval(rect, b);
        this._pathItem.dispElement = this;
        this._boundingBox = new skRectBounds(this);

        this._pathItem.rotate(this.skElement().angle(), rect.center);
        this._boundingBox.rotate(this.skElement().angle());

        this.setDrawingStyle(this._pathItem, this.skElement());

        this._invisibleCenter = new skInvisibleCenterPoint(rect.center, this);
    }

    this.clonePathItem = function (pt1, pt2) {
        var tempPathItem = new Path.Oval(new Rectangle(pt1, pt2), this.skElement().geom().circum());
        tempPathItem.rotate(this.skElement().angle(), pt1.add(pt2).multiply(0.5));
        this.setDrawingStyle(tempPathItem, this.skElement());
        return tempPathItem;
    }
    
    this.getConstrainableGeometry = function (pathItem, point) {
        if (pathItem.invisibleCenter) {
            var center = pathItem.position;
            return skConv.toMathPoint(center);
        }        
        return null;
    }

    this.init();
}

skDispOval.prototype = new skDispElement();

//-------------------------------------------------
//
//	skDispRectangle
//
//-------------------------------------------------

function skDispRectangle(rect) {
    skDispElement.call(this, rect);

    this.init = function () {
        var rectElement = this.skElement();
        var rect = skConv.toPaperRect(rectElement.geom());
        
        this._pathItem = new Path.Rectangle(rect);
        this._pathItem.dispElement = this;
        this._boundingBox = new skRectBounds(this);

        this._pathItem.rotate(this.skElement().angle(), rect.center);
        this._boundingBox.rotate(this.skElement().angle());

        this.setDrawingStyle(this._pathItem, this.skElement());
    }

    this.clonePathItem = function (pt1, pt2) {
        var tempPathItem = new Path.Rectangle(pt1, pt2);
        tempPathItem.rotate(this.skElement().angle(), pt1.add(pt2).multiply(0.5));
        this.setDrawingStyle(tempPathItem, this.skElement());
        return tempPathItem;
    }
    
    this.getConstrainableGeometry = function (pathItem, point) {
        if (pathItem.owningBBoxElement) {
            var bboxElement = pathItem.owningBBoxElement;
            if (bboxElement instanceof skBBoxEdge) {
                var pt1 = pathItem.firstSegment.point;
                var pt2 = pathItem.lastSegment.point;
                return new skMLineSegment(skConv.toMathPoint(pt1), skConv.toMathPoint(pt2));
            }
            else if (bboxElement instanceof skBBoxCornerPt) {
                var pt = pathItem.position;
                return skConv.toMathPoint(pt);            
            }        
        }
        
        return null;
    }

    this.init();
}

skDispRectangle.prototype = new skDispElement();

//-------------------------------------------------
//
//	skBoundingBox: a group of path items forming the bounding box of the dispElement
//
//-------------------------------------------------

function skBoundingBox(displayElement) {
    if (displayElement)
        this.dispElement = displayElement;      // add a property for bounding box

    this._items = [];

    this.add = function (pathItem) {
        this._items.push(pathItem)
    }

    this.removePathItems =  function() {
        var i;
        for (i = 0; i <this._items.length; i++) {
            this._items[i].remove();
        }
    }
    
    this.setVisible = function (b) {
        var i;
        for (i = 0; i < this._items.length; i++) {
            this._items[i].visible = b;
        }
    }
}

//-------------------------------------------------
//
//	bounding box for line
//
//-------------------------------------------------

function skLineBounds(dispLine) {
    skBoundingBox.call(this, dispLine);

    var pathLine = dispLine.pathItem();    
    var linkedList = new skLinkedList();
    linkedList.push(new skBBoxLineEndPt(pathLine.firstSegment.point, this));
    linkedList.push(new skBBoxLineEndPt(pathLine.lastSegment.point, this));

    var start = linkedList.head();
    var end = linkedList.head().next;

    this.defPt1 = function () {
        return start.position;
    }

    this.defPt2 = function () {
        return end.position;
    }

    this.move = function (delta) {
        start.move(delta);
        end.move(delta);
    }
}

skLineBounds.prototype = new skBoundingBox();

//-------------------------------------------------
//
//	bounding box for other geometries like oval, circle, triangle, ..., etc
//
//-------------------------------------------------

function skRectBounds(dispElement) {
    skBoundingBox.call(this, dispElement);

    var pathItem = dispElement.pathItem();
    var skelement = dispElement.skElement();
    var rect = pathItem.bounds;

    this._center = rect.center;
    
    // get handle position
    //
    var handleLength = 20;
    var handleStart = rect.topCenter;
    var handleEnd = handleStart.add(0, -handleLength);

    // create edges
    //
    new skBBoxEdge(rect.topLeft, rect.bottomLeft, this);
    new skBBoxEdge(rect.bottomLeft, rect.bottomRight, this);
    new skBBoxEdge(rect.bottomRight, rect.topRight, this);
    new skBBoxEdge(rect.topRight, rect.topLeft, this);
    new skBBoxEdge(handleStart, handleEnd, this);

    // create handle end point
    //
    new skBBoxHandleEndPt(handleEnd, this);

    // create corner points and mid points
    //
    var linkedList = new skLinkedList();
    linkedList.push(new skBBoxCornerPt(rect.topLeft, this));
    linkedList.push(new skBBoxEdgeMidPt(rect.leftCenter, this));
    linkedList.push(new skBBoxCornerPt(rect.bottomLeft, this));
    linkedList.push(new skBBoxEdgeMidPt(rect.bottomCenter, this));
    linkedList.push(new skBBoxCornerPt(rect.bottomRight, this));
    linkedList.push(new skBBoxEdgeMidPt(rect.rightCenter, this));
    linkedList.push(new skBBoxCornerPt(rect.topRight, this));
    linkedList.push(new skBBoxEdgeMidPt(rect.topCenter, this));

    this.oppositeBBoxElement = function (bboxElement) {
        return bboxElement.next.next.next.next;
    }

    var upperLeft = linkedList.head();
    var lowerRight = this.oppositeBBoxElement(upperLeft);

    this.defPt1 = function () {
        return upperLeft.position;
    }

    this.defPt2 = function () {
        return lowerRight.position;
    }

    this.move = function (delta) {
        upperLeft.position = upperLeft.position.add(delta);
        lowerRight.position = lowerRight.position.add(delta);
        this.center = this._center.add(delta);
    }

    this.rotate = function (angle) {        // rotate about bounding box center
        var center = this.center();
        var i;
        for (i = 0; i < this._items.length; i++) {
            this._items[i].rotate(angle, center);
        }
    }

    this.center = function () {
        return this._center;
    }

    this.setCenter = function (pt) {        // center is always global
        this._center = pt;
    }
}

skRectBounds.prototype = new skBoundingBox();

//-------------------------------------------------
//
//	skAnchorPoint: the anchor point on bounding box used to resize the bounding box
//
//-------------------------------------------------

function skBBoxElement() {
    this.position = null;

    this.setBoundingBox = function (bbox) {
        this.owningBBox = bbox;                 // attach properties
        this._pathItem.owningBBox = bbox;
        this._pathItem.dispElement = bbox.dispElement;
        bbox.add(this._pathItem);
    }

    this.r = function () {
        return 4;
    }

    this.init = function (pt, pathItem, bbox) {
        this.position = pt;
        this._pathItem = pathItem;
        this._pathItem.owningBBoxElement = this;
        this.setBoundingBox(bbox);
    }
}


//-------------------------------------------------
//
//	skBBoundingBoxHandleEndPoint
//
//-------------------------------------------------

function skBBoxHandleEndPt(pt, bbox) {
    skBBoxElement.call(this);

    var pathItem = Path.Circle(pt, this.r());
    pathItem.style = {
        fillColor: '#8BE73D',
        strokeColor: '#385D8A',
        strokeWidth: 1,
        opacity: 0.5
    };

    this.init(pt, pathItem, bbox);
    this.isHandlePt = true;

    this.setCursorStyle = function () {
        rnGraphicsManager.drawingCanvas().style.cursor = "url(\"img\\\\cursor_rotate_highlight.cur\") 10 10, crosshair";
    }
}

skBBoxHandleEndPt.prototype = new skBBoxElement();

//-------------------------------------------------
//
//	skBoundingBoxEdge
//
//-------------------------------------------------

function skBBoxEdge(pt1, pt2, bbox) {
    skBBoxElement.call(this);

    var pathItem = new Path.Line(pt1, pt2);
    pathItem.style = {
        strokeColor: '#385D8A',
        strokeWidth: 1,
        opacity: 0.5
    };

    this.init(pt1, pathItem, bbox);

    this.setCursorStyle = function () {
        // none-op
    }
}

skBBoxEdge.prototype = new skBBoxElement();

//-------------------------------------------------
//
//	skBoundingBoxAnchorPoint
//
//-------------------------------------------------

function skBBoxAnchorPt() {
    skBBoxElement.call(this);
	this.isAnchorPt = true;

    this.globalPos = function () {
        var center = this.owningBBox.center();
        var angle = this.owningBBox.dispElement.skElement().angle();
        var pt = this.position;
        pt = pt.rotate(angle, center);
        return pt;
    }

    this.setPos = function (globalPos) {
        var center = this.owningBBox.center();
        var angle = this.owningBBox.dispElement.skElement().angle();
        var pt = globalPos;
        this.position = pt.rotate(-angle, center);
    }
	
	this.setCursorStyle = function () {
        this.setCursorStyleByVec(this.getVector());
    }

    this.setCursorStyleByVec = function (vec) {
        var canvas = rnGraphicsManager.drawingCanvas();

        // flip vectors in 2nd/3rd quadrant to 1st/4th quadrant
        //
        if (vec.x < 0) {
            vec.set(-vec.x, -vec.y);
        }

        // determine cursor style
        //
        if (vec.x < 0.382683) {     //sin(22.5 deg) == 0.382683
            canvas.style.cursor = "n-resize";
        }
        else if (vec.x > 0.92388) {     //cos(22.5 deg) == 0.92388
            canvas.style.cursor = "e-resize";
        }
        else if (vec.y > 0) {
            canvas.style.cursor = "se-resize";
        }
        else
            canvas.style.cursor = "ne-resize";
    }
}

skBBoxAnchorPt.prototype = new skBBoxElement();

//-------------------------------------------------
//
//	skBoundingBoxCornerAnchorPoint
//
//-------------------------------------------------

function skBBoxCornerPt(pt, bbox) {
    skBBoxAnchorPt.call(this);

    var pathItem = Path.Circle(pt, this.r());
    pathItem.style = {
        fillColor: '#C5E6EA',
        strokeColor: '#385D8A',
        strokeWidth: 1,
        opacity: 0.5
    };

    this.init(pt, pathItem, bbox);

    this.getVector = function () {
        var cornerPt = this.globalPos();
        var neighborPt1 = this.prev.globalPos();
        var neighborPt2 = this.next.globalPos();

        var vec1 = neighborPt1.subtract(cornerPt).normalize();
        var vec2 = neighborPt2.subtract(cornerPt).normalize();
        var pt1 = cornerPt.add(vec1);
        var pt2 = cornerPt.add(vec2);
        var mid = pt1.add(pt2).multiply(0.5);
        var vec = cornerPt.subtract(mid).normalize();
        return vec;
    }

    this.move = function (delta) {  
        this.prev.move(delta);
        this.next.move(delta);
    }
}

skBBoxCornerPt.prototype = new skBBoxAnchorPt();

//-------------------------------------------------
//
//	skBBoundingBoxEdgeMidPoint
//
//-------------------------------------------------

function skBBoxEdgeMidPt(pt, bbox) {
    skBBoxAnchorPt.call(this);

    var pathItem = new Path.Rectangle(pt.x - this.r(), pt.y - this.r(), 2*this.r(), 2*this.r());
    pathItem.style = {
        fillColor: '#C5E6EA',
        strokeColor: '#385D8A',
        strokeWidth: 1,
        opacity: 0.5
    };

    this.init(pt, pathItem, bbox);

    this.getVector = function () {
        var edgePt = this.globalPos();
        var oppEdgePt = this.owningBBox.oppositeBBoxElement(this).globalPos();

        var vec = edgePt.subtract(oppEdgePt).normalize();
        return vec;
    }

    this.move = function (delta) {
        // this resizing causes the center change, hence all anchor points' local coordinate will change
        // cache the old anchor point's global positions
        //
        var pos = [];
        var i = 0;
        var length = 8;
        var current = this;
        for (i = 0, current = this; i < length; i++) {
            pos[i] = current.globalPos();
            current = current.next;
        }

        // 5 anchor point's global position will change
        //
        var edgePt = pos[0];
        var oppEdgePt = pos[4];
        var n = edgePt.subtract(oppEdgePt).normalize();
        var moveVec = n.multiply(n.dot(delta));

        pos[7] = pos[7].add(moveVec);
        pos[1] = pos[1].add(moveVec);
        pos[0] = pos[0].add(moveVec);

        pos[2] = pos[1].add(pos[3]).multiply(0.5);
        pos[6] = pos[7].add(pos[5]).multiply(0.5);

        // set new center
        //
        var newCent = pos[0].add(pos[4]).multiply(0.5);
        this.owningBBox.setCenter(newCent);

        // update all anchor points' local coordinate
        //
        current = this;
        for (i = 0; i < length; i++) {
            current.setPos(pos[i]);
            current = current.next;
        }
    }
}

skBBoxEdgeMidPt.prototype = new skBBoxAnchorPt();

//-------------------------------------------------
//
//	skLineEndAnchorPoint
//
//-------------------------------------------------

function skBBoxLineEndPt(pt, bbox) {
    skBBoxAnchorPt.call(this);

    var pathItem = Path.Circle(pt, this.r());
    pathItem.style = {
        fillColor: '#C5E6EA',
        strokeColor: '#385D8A',
        strokeWidth: 1,
        opacity: 0.5
    };

    this.init(pt, pathItem, bbox);

    this.setCursorStyle = function () {
        var pt1 = this.position;
        var pt2 = this.prev.position;
        var vec = pt1.subtract(pt2);
        var mul = vec.x * vec.y;
        if (mul > 0)        // note the canvas coordinate system is y-flip with normal orthogonal system
            rnGraphicsManager.drawingCanvas().style.cursor = "se-resize";
        else
            rnGraphicsManager.drawingCanvas().style.cursor = "ne-resize";
    }

    this.move = function (delta) {
        this.position = this.position.add(delta);
    }

}

skBBoxLineEndPt.prototype = new skBBoxAnchorPt();

//-------------------------------------------------
//
//	skLinkedList: a simple double circuit linked list
//
//-------------------------------------------------

function skLinkedList() {
    this._head = null;
    this._tail = null;
    
    this.head = function() {
        return this._head;
    }
    
    this.push = function (node) {
        node.owningLinkedList = this;
        if (!this._head) {
            this._head = node;
            this._tail = node;
            node.prev = node;
            node.next = node;
        }
        else {
            this._tail.next = node;
            node.prev = this._tail;
            node.next = this._head;
            this._head.prev = node;
            
            this._tail = node;
        }
    }
}


//-------------------------------------------------
//
//	highlight geometry -- currently only used in skCreateDimensionCommand
//
//-------------------------------------------------

function skHighlightGeometry(mgeom, skelement, hitPathItem) {
    this._mathGeom = mgeom;
    this._skElement = skelement;
    this._originalHitPathItem = hitPathItem;
    this._pathItem = null;    

    this.mathGeom = function () {
        return this._mathGeom;
    }

    this.skElement = function () {
        return this._skElement;
    }

    this.originalHitPathItem = function () {
        return this._originalHitPathItem;
    }

    this.pathItem = function () {
        return this._pathItem;
    }

    this.setAsHighlightedColor = function () {
        if (this._pathItem) {
            this._pathItem.style = {
                fillColor: 'red',
                strokeColor: 'red',
                strokeWidth: 3
            };
        }
    }

    this.setAsSelectedColor = function () {
        if (this._pathItem) {
            this._pathItem.style = {
                fillColor: 'blue',
                strokeColor: 'blue',
                strokeWidth: 3
            }
        }
    }

    // create the path item
    //
    var pItem;
    if (mgeom instanceof skMPoint) {
        pItem = new Path.Circle(skConv.toPaperPoint(mgeom), 3);
    }
    else if (mgeom instanceof skMLineSegment) {
        pItem = new Path.Line(skConv.toPaperPoint(mgeom.startPt()),
                                 skConv.toPaperPoint(mgeom.endPt()));
    }

    this._pathItem = pItem;
}

//-------------------------------------------------
//
//	skDispConstraint: the display object of dimensions and constraints
//
//-------------------------------------------------

function skDispConstraint(skCon) {
    this._skConstraint = skCon;
    this._pathItems = [];

    this.pathItems = function () {
        return this._pathItems;
    }

    this.addPathItem = function (item) {
        this._pathItems.push(item);
    }

    this.clearPathItems = function () {
        this._pathItems.splice(0, this._pathItems.length);
    }

    this.applyPathStyle = function () {
        var i;
        for (i = 0; i < this._pathItems.length; i++) {
            this._pathItems[i].style = {
                fillColor: 'green',
                strokeColor: 'green'
            }
        }
    }
}

//-------------------------------------------------
//
//	skDispDimension
//
//-------------------------------------------------

function skDispDimension(skDim) {
    skDispConstraint.call(this, skDim);
    this._textPos = null;

    this.evaluateDefPoints = function (pos) { };
    this.drawDimensionLines = function () { };
    this.drawArrows = function () { };
    this.drawText = function () { };

    this.draw = function (pos) {
        this._textPos = pos;
        this.evaluateDefPoints(pos);

        this.drawDimensionLines();
        this.drawArrows();
        this.drawText();

        this.applyPathStyle();
    }

    // given a point and a vector, create the path item that represent the arrow head
    //
    this.drawArrow = function (pt, vec) {
        var scale = 8;
        var height = 1.4;
        var width = 0.8;
        
        var pt1 = pt;
        var negVec = vec.multiply(-1).normalize();
        var perpVec = new Point(negVec.y, -negVec.x);
        var mid = pt1.add(negVec.multiply(scale*height));
        var pt2 = mid.add(perpVec.multiply(scale*width*0.5));
        var pt3 = mid.add(perpVec.multiply(-1*scale*width*0.5));
        
        var path = new Path();
        path.closed = true;
        path.add(pt1);
        path.add(pt2);
        path.add(pt3);

        this.addPathItem(path);
    }
}

skDispDimension.prototype = new skDispConstraint();

//-------------------------------------------------
//
//	skDispLinearDimension
//
//-------------------------------------------------

function skDispLinearDimension(skDim) {
    skDispDimension.call(this, skDim);

    this._dimPt1 = null;
    this._dimPt2 = null;
    this._leadPt1 = null;
    this._leadPt2 = null;

    this.getDimPt1 = function () {
        return this._dimPt1;
    }

    this.getDimPt2 = function () {
        return this._dimPt2;
    }

    this.getLeadPt1 = function () {
        return this._leadPt1;
    }

    this.getLeadPt2 = function () {
        return this._leadPt2;
    }

    this.drawDimensionLines = function () {
        var dimPt1 = skConv.toPaperPoint(this.getDimPt1());
        var dimPt2 = skConv.toPaperPoint(this.getDimPt2());
        var leadPt1 = skConv.toPaperPoint(this.getLeadPt1());
        var leadPt2 = skConv.toPaperPoint(this.getLeadPt2());
        
        var pt1, pt2;
        var pos = this._textPos;
        var d1 = pos.getDistance(dimPt1, false);
        var d2 = pos.getDistance(dimPt2, false);
        var d3 = dimPt1.getDistance(dimPt2, false);
        if (skMath.isEqual(d1 + d2, d3)) {
            pt1 = dimPt1;
            pt2 = dimPt2;
        }
        else {
            pt1 =  pos;
            if (d1 > d2)
                pt2 = dimPt1;
            else
                pt2 = dimPt2;
        }

        this.addPathItem(new Path.Line(pt1, pt2));
        this.addPathItem(new Path.Line(leadPt1, dimPt1));
        this.addPathItem(new Path.Line(leadPt2, dimPt2));
    }

    this.drawText = function () {
        var pos = this._textPos;
        var text = new PointText(pos);
        text.justification = 'center';
        text.fillColor = 'green';
        text.content = this._skConstraint.offset().toFixed(3).toString();

        // rotate the text to align with dimension line
        //
        var dimPt1 = skConv.toPaperPoint(this.getDimPt1());
        var dimPt2 = skConv.toPaperPoint(this.getDimPt2());
        var vec = dimPt2.subtract(dimPt1).normalize();
        var xAxis = new Point(1, 0)
        if (vec.dot(xAxis) < 0)
            vec = vec.multiply(-1);
        var angle = xAxis.getDirectedAngle(vec);
        text.rotate(angle, pos);

        // move the text a little bit above the dimension line so it looks more clear
        //
        var yAxis = new Point(0, -1);
        var newY = yAxis.rotate(angle, new Point(0, 0));
        var scale = 4;
        text.translate(newY.multiply(scale));

        this.addPathItem(text);
    }

    this.drawArrows = function () {
        var dimPt1 = skConv.toPaperPoint(this.getDimPt1());
        var dimPt2 = skConv.toPaperPoint(this.getDimPt2());
        var vec1 = dimPt1.subtract(dimPt2);
        var vec2 = dimPt2.subtract(dimPt1);
        this.drawArrow(dimPt1, vec1);
        this.drawArrow(dimPt2, vec2);
    }
}

skDispLinearDimension.prototype = new skDispDimension();

//-------------------------------------------------
//
//	skDispDistPtLn
//
//-------------------------------------------------

function skDispDistPtLn(skDim) {
    skDispLinearDimension.call(this, skDim);

    this.evaluateDefPoints = function (pos) {
        var mPt, mLnSeg;

        var skDim = this._skConstraint;
        if (skDim.geom1() instanceof skMPoint) {
            mPt = skDim.geom1();
            mLnSeg = skDim.geom2();
        }
        else {
            mPt = skDim.geom2();
            mLnSeg = skDim.geom1();
        }

        var mLn = mLnSeg.getLine();

        var q = mPt.subtract(mLn.startPt());
        var lateral = q.dot(mLn.direction());
        var projectionPt = mLn.startPt().add(mLn.direction().multiply(lateral));
        var vec = mPt.subtract(projectionPt);

        var q1 = skConv.toMathPoint(pos).subtract(mLn.startPt());
        var lateral1 = q1.dot(mLn.direction());
        this._dimPt1 = mLn.startPt().add(mLn.direction().multiply(lateral1));

        var dist1 = this._dimPt1.distance(mLnSeg.startPt());
        var dist2 = this._dimPt1.distance(mLnSeg.endPt());
        if (skMath.isEqual(dist1 + dist2, mLnSeg.length()))
            this._leadPt1 = this._dimPt1;
        else {
            if (dist1 < dist2)
                this._leadPt1 = mLnSeg.startPt();
            else
                this._leadPt1 = mLnSeg.endPt();
        }

        this._leadPt2 = mPt;
        this._dimPt2 = this._dimPt1.add(vec);
    }
}

skDispDistPtLn.prototype = new skDispLinearDimension();

//-------------------------------------------------
//
//	skDispDistPtPt
//
//-------------------------------------------------

function skDispDistPtPt() {
    skDispLinearDimension.call(this);
}

skDispDistPtPt.prototype = new skDispLinearDimension();

//-------------------------------------------------
//
//	skDispDistLnLn
//
//-------------------------------------------------

function skDispDistLnLn() {
    skDispLinearDimension.call(this);
}

skDispDistLnLn.prototype = new skDispLinearDimension();

//-------------------------------------------------
//
//	skDispAngularDimension
//
//-------------------------------------------------

function skDispAngularDimension() {
    skDispDimension.call(this);
}

skDispAngularDimension.prototype = new skDispDimension();

//-------------------------------------------------
//
//	skDispAngLnLn
//
//-------------------------------------------------

function skDispAngLnLn() {
    skDispAngularDimension.call(this);
}

skDispAngLnLn.prototype = new skDispAngularDimension();

//-------------------------------------------------
//
//	skDispGeomConstraint
//
//-------------------------------------------------

function skDispGeomConstraint() {
    skDispConstraint.call(this);
}

skDispGeomConstraint.prototype = new skDispConstraint();