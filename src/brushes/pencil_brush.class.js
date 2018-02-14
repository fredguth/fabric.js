(function() {

  /**
   * PencilBrush class
   * @class fabric.PencilBrush
   * @extends fabric.BaseBrush
   */
  fabric.PencilBrush = fabric.util.createClass(fabric.BaseBrush, /** @lends fabric.PencilBrush.prototype */ {

    /**
     * Constructor
     * @param {fabric.Canvas} canvas
     * @return {fabric.PencilBrush} Instance of a pencil brush
     */
    initialize: function(canvas) {
      this.canvas = canvas;
      this._points = [];
      this._path = [];
    },

    /**
     * Inovoked on mouse down
     * @param {Object} pointer
     */
    onMouseDown: function(pointer) {
      this._prepareForDrawing(pointer);
      // capture coordinates immediately
      // this allows to draw dots (when movement never occurs)
      this._captureDrawingPath(pointer);
      this._render();
    },

    /**
     * Inovoked on mouse move
     * @param {Object} pointer
     */
    onMouseMove: function(pointer) {
      this._captureDrawingPath(pointer);
      this._render();
    },

    /**
     * Invoked on mouse up
     */
    onMouseUp: function() {
      this._finalizeAndAddPath();
    },

    /**
     * @private
     * @param {Object} pointer Actual mouse position related to the canvas.
     */
    _prepareForDrawing: function(pointer) {

      var p = new fabric.Point(pointer.x, pointer.y);

      this._reset();
      this._addPoint(p);

      this.canvas.contextTop.moveTo(p.x, p.y);
    },

    /**
     * @private
     * @param {fabric.Point} point Point to be added to points array
     */
    _addPoint: function(point) {
      if (this._points.length > 1 && point.eq(this._points[this._points.length - 1])) {
        return;
      }
      this._points.push(point);
    },

    /**
     * Clear points array and set contextTop canvas style.
     * @private
     */
    _reset: function() {
      this._points.length = 0;
      this._path.length = 0;

      this._setBrushStyles();
      this._setShadow();
    },

    /**
     * @private
     * @param {Object} pointer Actual mouse position related to the canvas.
     */
    _captureDrawingPath: function(pointer) {
      var pointerPoint = new fabric.Point(pointer.x, pointer.y);
      this._addPoint(pointerPoint);
    },

    /**
     * One can think of a bezier curve in several ways. One way is to imagine
     * it as an anchor point (also known as joint or knot) with 2 control points
     * at each side, handle In and handle out. As we want a sequence of bezier curves
     * that look "smooth", we need to construct handles with this property.
     *
     * This in known as the Continuity problem. Two curves in sequence
     * B[t0-t1], p0p1, and B[t1-t2], p1p2, will look smooth if B'[t1] and B''[t1] at each
     * curve is the same. In more technical terms, the function below find
     * control points that satisfy G1 (the handles have the same slope, but not the same
     * magnitude).
     *
     * A good explanation of this construction method can be found at:
     * http://scaledinnovation.com/analytics/splines/aboutSplines.html
     *
     * @private
     */
    _getControlPoints: function(p0, p1, p2, t = 0.4) {
      let h = p2.y - p0.y; // height of equilateral triangle with verticies p0, p2
      let w = p2.x - p0.x; // width of same triangle

      let d_01 = p1.distanceFrom(p0);
      let d_12 = p2.distanceFrom(p1);

      let fIn  = t * d_01 / (d_01 + d_12); // scaling factor for p1 Handle In
      let fOut = t * d_12 / (d_01 + d_12); // same for Handle Out

      let p1p2 = p2.subtract(p1);
      let handleIn  = p1.subtract(p1p2.multiply(fIn));
      let handleOut = p1.add(p1p2.multiply(fOut));
      return { handleIn, handleOut };

    },

    /**
     * Draw a smooth path on the topCanvas using quadraticCurveTo
     * @private
     */
    _render: function() {
      var ctx  = this.canvas.contextTop,
          i,
          len = this._points.length,
          p0 = this._points[0],
          p1 = this._points[1];

      if (!p0) {
        return;
      }
      ctx.beginPath();

      ctx.moveTo(p0.x, p0.y);
      this._path.push(`M ${p0.x} ${p0.y}`);

      //if we only have 2 points in the path and they are the same
      //it means that the user only clicked the canvas without moving the mouse
      //then we should be drawing a dot. A path isn't drawn between two identical dots
      //that's why we set them apart a bit
      if (len === 2 && p0.x === p1.x && p0.y === p1.y) {
        var width = this.width / 1000;

        p0.x -= width;
        p1.x += width;
        ctx.lineTo(p1.x, p1.y);
        this._path.push(`L ${p1.x} ${p1.y}`);

        // after using points, discard them.
        this._points.shift();
      }

      if (len > 2) {
        // need at least 4 points. If there is only 3, repeat first.
        if (len == 3) {
          this._points.unshift(this._points[0]);
        }

        var p2 = this._points[2],
            p3 = this._points[3];

        let p1_handles = this._getControlPoints(p0, p1, p2);
        let p2_handles = this._getControlPoints(p1, p2, p3);

        ctx.moveTo(p1.x, p1.y);
        this._path.push(`M ${p1.x} ${p1.y}`);

        ctx.bezierCurveTo(p1_handles.handleOut.x, p1_handles.handleOut.y, p2_handles.handleIn.x, p2_handles.handleIn.y, p2.x, p2.y);
        this._path.push(`C ${p1_handles.handleOut.x} ${p1_handles.handleOut.y}, ${p2_handles.handleIn.x} ${p2_handles.handleIn.y},  ${p2.x} ${p2.y}`);

        this._points.shift(); //keep only 4 points
      }

      ctx.closePath();
      ctx.stroke();

    },

    /**
     * Converts points to SVG path
     * @param {Array} points Array of points
     * @return {String} SVG path
     */
    convertPointsToSVGPath: function(points) {
      return this._path || [];
    },

    /**
     * Creates fabric.Path object to add on canvas
     * @param {String} pathData Path data
     * @return {fabric.Path} Path to add on canvas
     */
    createPath: function(pathData) {
      var path = new fabric.Path(pathData, {
        fill: null,
        stroke: this.color,
        strokeWidth: this.width,
        strokeLineCap: this.strokeLineCap,
        strokeMiterLimit: this.strokeMiterLimit,
        strokeLineJoin: this.strokeLineJoin,
        strokeDashArray: this.strokeDashArray,
      });
      var position = new fabric.Point(path.left + path.width / 2, path.top + path.height / 2);
      position = path.translateToGivenOrigin(position, 'center', 'center', path.originX, path.originY);
      path.top = position.y;
      path.left = position.x;
      if (this.shadow) {
        this.shadow.affectStroke = true;
        path.setShadow(this.shadow);
      }

      return path;
    },

    /**
     * On mouseup after drawing the path on contextTop canvas
     * we use the points captured to create an new fabric path object
     * and add it to the fabric canvas.
     */
    _finalizeAndAddPath: function() {
      var ctx = this.canvas.contextTop;
      ctx.closePath();

      var pathData = this.convertPointsToSVGPath(this._points).join('');
      if (pathData === 'M 0 0 Q 0 0 0 0 L 0 0') {
        // do not create 0 width/height paths, as they are
        // rendered inconsistently across browsers
        // Firefox 4, for example, renders a dot,
        // whereas Chrome 10 renders nothing
        this.canvas.requestRenderAll();
        return;
      }

      var path = this.createPath(pathData);
      this.canvas.clearContext(this.canvas.contextTop);
      this.canvas.add(path);
      this.canvas.renderAll();
      path.setCoords();
      this._resetShadow();


      // fire event 'path' created
      this.canvas.fire('path:created', { path: path });
    }
  });
})();
