(function($, window, undefined) {
  'use strict';

  /* 
    Constructor
    element – html element
    options – plugin initial options
  */
  function Plugin( element, options ) {
    this._name           = Plugin.pluginName;
    this.el              = element;
    this.$el             = $( element );
    this.ui              = {};   // Object for DOM elements
    this._selected       = 0;    // Amount of selected items
    this._isEnable       = true; // Flag that plugin is enabled - used by handlers
    this._keyModes       = {};   // to saving holding keys
    this.options         = {};
    
    var newOptions = $.extend( {}, Plugin.defaults, (options || {}) );
    this._setOptions( newOptions );
    this._init();
  }

  // var
  Plugin.pluginName     = 'selectonic';
  Plugin.keyCode        = { DOWN:40, UP:38, SHIFT:16, END:35, HOME:36, PAGE_DOWN:34, PAGE_UP:33, A:65 };
  Plugin.optionsEvents  = ['create','before','focusLost','select','unselect','unselectAll','stop','destroy'];
  Plugin.optionsStrings = ['filter','mouseMode','event','listClass','focusClass','selectedClass','disabledClass','handle'];
  Plugin.defaults       = {
    // Base
    filter:         '> *',
    multi:          true,
    // Mouse
    mouseMode:      'select',    /* 'select' | 'toggle' */
    event:          'mousedown', /* 'mousedown' | 'click' | 'hybrid' */
    focusBlur:      false,
    selectionBlur:  false,
    handle:         null,        /* String | null */
    textSelection:  false,
    // Keyboard
    keyboard:       false,
    autoScroll:     true,        /* String | false | true */
    loop:           false,
    preventInputs:  true,
    // Classes
    listClass:      ( 'j-selectable' ),
    focusClass:     ( 'j-focused' ),
    selectedClass:  ( 'j-selected' ),
    disabledClass:  ( 'j-disabled' ),
    // Callbacks
    create:         null,
    before:         null,
    focusLost:      null,
    select:         null,
    unselect:       null,
    unselectAll:    null,
    stop:           null,
    destroy:        null
  };

  // Get plugin's data object:
  Plugin.getDataObject = function( el ) {
    return $( el ).data( 'plugin_' + Plugin.pluginName );
  };



  /* ==============================================================================

  Core

  */
  Plugin.prototype._init = function() {
    this.$el.addClass( this.options.listClass );            // Add class to box
    this._onHandler();                                      // Attach handlers6
    this.$el.data( 'plugin_' + Plugin.pluginName, this );   // Save plugin's object instance
    this._callEvent('create');                              // Callback
  };


  Plugin.prototype._setOptions = function() {
    var option, newOptions, isFunction, options = {}, self = this;
    
    if ( arguments.length === 2 ) {
      // First arg is name of option and a second is a value
      options[arguments[ 0 ]] = arguments[1];
    } else {
      // options hash
      if ( $.isPlainObject(options) ) {
        options = arguments[0];
      } else {
        throw new Error("Option should be a pair arguments of name and value or should be a hash of pairs.");
      }
    }
  
    // Ensure that actions are strings
    $.each( Plugin.optionsStrings, function(index, val) {
      option = options[val];
      if( option ) {
        // Turn in a string and trim spaces
        option = $.trim( String(option) );
        // If it's working list and is attempt to change classes
        if ( self.options.parentSelector &&
          (val === 'listClass' ||
           val === 'focusClass' ||
           val === 'selectedClass' ||
           val === 'disabledClass')
        ) { throw new Error( 'Sorry, it\'s not allowed to dynamically change classnames!' ); }
      }
    });

    // Ensure that callbacks options are functions
    $.each( Plugin.optionsEvents, function(index, name) {
      option = options[name];
      if( void 0 === option ) { return; }
      isFunction = $.isFunction( option );
      if ( !isFunction && null !== option ) {
        throw new Error( 'Option \"' + name + '\" should be a function or \"null\"!' );
      }
    });

    newOptions = $.extend( {}, this.options, options );
    // Cache items selector to compare it with clicked elements
    // Plugin's class name + Item selector
    newOptions.parentSelector = '.' + newOptions.listClass + ' ' + newOptions.filter;

    // Set scrollable containter
    if ( options.autoScroll !== void 0 ) { this._setScrolledElem( options.autoScroll ); }
    this.options = newOptions;
  };


  Plugin.prototype._destroy = function() {

    // Callback before removing plugin data
    this._callEvent('destroy');

    // Detach handlers
    this._offHandler();

    // If focus exists
    if( this.ui.focus ) {
      // remove class and property
      $(this.ui.focus).removeClass( this.options.focusClass );
      delete this.ui.focus;
    }

    // If there are selected items
    if( this._selected > 0 ) {
      // find items and remove class
      this.getSelected().removeClass( this.options.selectedClass );
    }

    // Remove classes
    this.$el.removeClass( this.options.disabledClass );
    this.$el.removeClass( this.options.listClass );

    if ( this._scrolledElem ) { delete this._scrolledElem; }
  };


  Plugin.prototype._setScrolledElem = function( selector ) {
    var elem;

    if ( null === selector || false === selector ) {
      delete this._scrolledElem;
      return;
    }
    
    if ( typeof selector === "string" ) {
      elem = $( selector );
      if (elem.length > 0) {
        this._scrolledElem = elem[0];
      } else {
        throw new Error('There are no elements that matches to selector - \"' + selector + '\"');
      }
      return;
    }

    this._scrolledElem = this.el;
  };


  Plugin.prototype._prevent = function() {
    this._isPrevented = true;
  };


  Plugin.prototype._cancel = function( e, params ) {
    params.isCancellation = true;

    // Restore items states
    $.each(
      // for each changed item
      $(params.changedItems),
      $.proxy(
        function( index, item ) {
          // there is boolean value in array prevItemsState
          // with same index that item have in _changedItems
          if ( params.prevItemsState[ index ] ) {
            this._select( e, params, $(item), true );
          } else {
            this._unselect( e, params, $(item), true );
          }
        }, this
      )
    );
    // Restore old focus
    if ( params.prevFocus ) {
      this._setFocus( params.prevFocus );
    }
    delete params.isCancellation;
    delete this._isPrevented;
    params.wasCancelled = true;
  };

  
  // Attath handlers
  Plugin.prototype._onHandler = function() {

    // Handler for mouse events
    this._mouseEventHandler = $.proxy( function(e) {
      if ( this._isEnable ) { this._mouseHandler(e); }
      return e;
    }, this );

    // Handler for keyboard events
    this._keyEventHandler = $.proxy( function(e) {
      if( this.options.keyboard && this._isEnable ) { this._keyHandler(e); }
      return e;
    }, this );
    
    // Handler for selection start
    this._selectstartHandler = $.proxy( function() {
      if ( !this.options.textSelection ) { return false; }
    }, this );

    $( window.document ).on(
      'click' + '.' + this._name + ' ' + 'mousedown' + '.' + this._name,
      this._mouseEventHandler
    );

    $( window.document ).on(
      'keydown' + '.' + this._name + ' ' + 'keyup' + '.' + this._name,
      this._keyEventHandler
    );

    this.$el.on(
      'selectstart' + '.' + this._name,
      this._selectstartHandler
    );
  };

  
  // Detach handlers
  Plugin.prototype._offHandler = function() {

    $( window.document ).off(
      'click' + '.' + this._name + ' ' + 'mousedown' + '.' + this._name,
      this._mouseEventHandler
    );

    $( window.document ).off(
      'keydown' + '.' + this._name + ' ' + 'keyup' + '.' + this._name,
      this._keyEventHandler
    );

    this.$el.off(
      'selectstart' + '.' + this._name,
      this._selectstartHandler
    );
  };


  // Get item, that was clicked
  // or null, if click was not on an item
  Plugin.prototype._getTarget = function( e ) {
    var elem = e.target,
      handle = this.options.handle,
      $elem, target, handleElem;

    // While plugin's element or top of the DOM is achieved
    while ( elem !== null && elem !== this.el ) {
      $elem = $(elem);
      // Set context, because old (< 1.10.0) versions of jQuery gives wrong result.
      $elem.context = window.document;

      // If item matches to selector
      if( $elem.is(this.options.parentSelector) ) {
        target = elem;
      }
      // If handle option is ON and that elem match to handle's selector
      if( handle && $elem.is( handle ) ) {
        handleElem = elem;
      }
      // Get parent element
      elem = elem.parentNode;
    }

    // If handle option is ON and it was found
    // and item of this list was clicked
    if( handle && elem && handleElem ) {
      return target;

    // If achieved $el of this instance of plugin's object
    } else if( !handle && elem ) {
      return target;
    }

    return null; // was not clicked any selectable items of a list
  };


  Plugin.prototype._getSelected = function( getIds ) {
    var arr, res, items;

    if( getIds ) {
      arr = [];
      items = this.$el.children( '.' + this.options.selectedClass );

      // Iterate through collection and return id or null
      $.each( items, function(index, elem) {
        arr.push( $(elem).attr('id') || null );
      });
      res = arr.length > 0 ? arr : null;

    } else { res = this.$el.children( '.' + this.options.selectedClass ); }

    return res;
  };


  Plugin.prototype._getItems = function( options, selection, elem ) {

    switch( selection ) {
    case 'next':
    case 'prev':
      var
      item = elem.jquery ? elem : $( elem ),
      find = $.fn[selection];

      while (true) {
        item = find.call( item );
        if ( item.length === 0 ) { break; }
        // Set context, because old (< 1.10.0) versions of jQuery gives wrong result.
        item.context = window.document;
        if ( item.is(options.parentSelector) ) { return item; }
      }
      return null;
    
    case 'pageup':
    case 'pagedown':
      var
        box           = this._scrolledElem || this.el,
        boxViewHeight = box.clientHeight,
        winViewHeight = $( window ).outerHeight(),
        $current      = $( elem ),
        isBoxBigger   = boxViewHeight > winViewHeight,
        pageHeight    = isBoxBigger ? winViewHeight : boxViewHeight,
        itemHeight    = $current.outerHeight(),
        currentHeight = itemHeight,
        itemsHeight   = itemHeight,
        direction     = (selection === 'pageup') ? 'prev' : 'next',
        $candidate, candHeight;

      while( true ) {
        $candidate = this._getItems( options, direction, $current );
        if ( !$candidate && $current.is( elem ) ) { break; } else if ( !$candidate ) { return $current; }
        
        candHeight = $candidate.outerHeight();
        itemsHeight = itemsHeight + candHeight;
        
        if ( itemsHeight > pageHeight ) {
          // If two items bigger than page than it just will give next item
          if ( currentHeight + candHeight > pageHeight ) { return $candidate; }
          return $current;
        }
        currentHeight = candHeight;
        $current = $candidate;
      }
      return null;

    case 'first': return this.$el.find( options.filter ).first();
    case 'last':  return this.$el.find( options.filter ).last();
    default:      return this.$el.find( options.filter );
    }
  };


  // Creates ui object and calls a callback from the options
  Plugin.prototype._callEvent = function( name, event, params ) {
    var ui, cb = this.options[name];
    if ( !cb ) { return; }
    if ( name === 'create' || name === 'destroy' ) {
      return cb.call( this.$el );
    }
    ui = {};
    if ( params.target ) { ui.target = params.target; }
    if ( this.ui.focus ) { ui.focus  = this.ui.focus; }

    switch ( name ) {
      case 'select':      ui.items = params.selected; break;
      case 'unselectAll':
      case 'unselect':    ui.items = params.unselected; break;
      case 'stop':        if ( !params.wasCancelled ) { ui.items = params.changedItems; } break;
    }
    // Pass to callback: elem, event object and new ui object
    cb.call( this.$el, event || null, ui );
  };


  // Control the state of a list
  // this method calls from _keyHandler and _mouseHandler or API
  // and do changes depending from passed params
  Plugin.prototype._controller = function( e, params ) {
    params.changedItems = [];
    params.prevItemsState = [];
    // Callback
    this._callEvent('before', e, params);

    // If cancel flag is true any changes will be prevented
    if( this._isPrevented ) {
      this._cancel( e, params ); // cancellation
      this._stop( e );
      return;
    }

    // Flag - if there was any selected items before changes
    params.wasSelected = ( this._selected > 0 );

    // Flag - if target was selectedl before changes
    if ( params.target && params.isTargetWasSelected === undefined ) {
      params.isTargetWasSelected = this._getIsSelected( params.target );
    }

    /* 
    If it is range selection
    and target is selected and equal to focus
    */
    if ( params.isRangeSelect && params.isTargetWasSelected && params.target === this.ui.focus ) {
      // do nothing

    // For range selections and multi-selection
    } else if ( params.isRangeSelect || params.isMultiSelect ) {
      if ( params.isTargetWasSelected ) {
        this._unselect( e, params, params.items );
      } else {
        this._select( e, params, params.items );
      }

    // Single selection
    } else if ( params.target ) {

      // If thre are selected
      if ( this._selected ) {

        // If there is one selected item and it is focused
        if ( this._selected === 1 && this._getIsSelected(this.ui.focus) ) {
          /* It is case, when user moves cursor by keys or chooses single items by mouse 
          — need just clear selection from focus — no need run go whole DOM of list */
          this._unselect( e, params, this.ui.focus, params.isTargetWasSelected );

        } else {
          this._unselectAll( e, params );
        }
      }
      // Select item. Callback 'select' calls only if target was selected
      this._select( e, params, params.items, params.isTargetWasSelected );

    } else {
      // if there are selected items and 'selectionBlur' option is true
      if ( this._selected > 0 && this.options.selectionBlur ) { this._unselectAll( e, params ); }
    }

    if( !this._selected && params.wasSelected ) {
      // Callback 
      this._callEvent('unselectAll', e, params);
    }
    
    // Cache old focus
    params.prevFocus = ( this.ui.focus ) ? this.ui.focus : null;

    // it is not item of list was clicked and 'focusBlur' option is ON
    if ( !params.target && this.options.focusBlur ) {
      this._blur(e, params);
    // or set new
    } else if ( params.target ) { this._setFocus( params.target ); }
    
    // End of the cycle
    this._stop( e, params );
  };


  Plugin.prototype._forEachItem = function( items, delta, params ) {
    /*
    'delta' is number to modifying selection counter
    above zero 'delta' from _select/ sub zero 'delta' from _unselect
    */
    var
      aboveZero = delta > 0,
      changedItems = [],
      self = this;

    // For each of items calls function in scope plugin's object instance
    $( items ).each( function( index, item ) {

      var
        isSelected = self._getIsSelected( item ),
        // Condition - if item is not selected (_select) or items is selected (_unselect)
        selectedCondition = ( aboveZero ) ? !isSelected : isSelected,
        // if the item is target and is selected
        isSelectedTarget = ( item === params.target && params.isTargetWasSelected );

      /*  If it's unselecting and item is selected target,
        and is not 'multi' or 'range' select mode
        — do nothing because state of selected target should not change
        – it is just unselecting other items  */
      if (
        isSelectedTarget &&
        !aboveZero &&
        !params.isMultiSelect &&
        !params.isRangeSelect
      ) { return; }

      if( selectedCondition ) {
        // it is not cancellation
        if( !params.isCancellation ) {
          changedItems.push( item );
          params.prevItemsState.push( isSelected );
        }
        self._selected += delta;
      }

      // Finally add/remove class to item
      $( item ).toggleClass( self.options.selectedClass, aboveZero );

    });

    // If it is not cancellation
    if( !params.isCancellation ) {
      params[ (aboveZero?'selected':'unselected') ] = $( changedItems );

      // Add items of this iteration to array of changed elements
      params.changedItems = params.changedItems.concat( changedItems );
    }
  };


  Plugin.prototype._select = function( e, params, items, silent ) {
    this._forEachItem( items, 1, params);
    if ( !silent ) { this._callEvent('select', e, params); }
    if( this._isPrevented && !params.isCancellation ) { this._cancel( e, params ); }
  };


  Plugin.prototype._unselect = function( e, params, items, silent ) {
    this._forEachItem( items, -1, params );
    if ( !silent ) { this._callEvent('unselect', e, params); }
    if( this._isPrevented && !params.isCancellation ) { this._cancel( e, params ); }
  };


  Plugin.prototype._unselectAll = function( e, params ) {
    var isOnlyTargetSelected, items;
    if( !this._selected || this._selected === 0 ) { return; }

    // Get all items
    items = this._getItems( this.options );
    // target was only selected item ( flag used for preventing callback )
    isOnlyTargetSelected = params.target && params.isTargetWasSelected && this._selected === 1;

    // this.ui.items = null;
    this._unselect( e, params, items, isOnlyTargetSelected );
  };


  Plugin.prototype._multiSelect = function( params ) {
    params.isMultiSelect = true;
    return $( params.target );
  };


  Plugin.prototype._rangeSelect = function( params ) {
    params.isRangeSelect = true;

    // If target is focused item - do nothing
    if( params.target === this.ui.focus ) { return $( params.target ); }

    // Detect position of target and focus in the list
    var arr = this._getItems( this.options ),
      x = arr.index( params.target ),
      y = arr.index( this.ui.focus ),

    // Get array of items between focus and target
    subArr =     ( x < y ) ? arr.slice( x, y ) : arr.slice( y, x );
    subArr.push( ( x < y ) ? arr[ y ]          : arr[ x ] );
    return subArr;
  };


  Plugin.prototype._getIsSelected = function( target ) {
    // If was get one item or nothing
    if( $(target).length <= 1 ) {
      return $( target ).hasClass( this.options.selectedClass );
    }

    var options = this.options;

    // Return array of boolean values
    return $.map( $(target), function( item ) {
      return $( item ).hasClass( options.selectedClass );
    });
  };


  Plugin.prototype._blur = function( e, params, silent ) {
    // If is not silent mode and focus exists
    if( !silent && this.ui.focus ) {
      // Callback of focus lost
      this._callEvent('focusLost', e, params);
    }

    if( this.ui.focus ) {
      // remove class from focus
      $( this.ui.focus ).removeClass( this.options.focusClass );
      delete this.ui.focus;
    }
  };


  Plugin.prototype._setFocus = function( target ) {
    if( !target ) { return; }

    if( this.ui.focus ) {
      // remove class from old focused item
      $(this.ui.focus).removeClass( this.options.focusClass );
    }

    this.ui.focus = target; // set new focus
    $( this.ui.focus ).addClass( this.options.focusClass );

    return this.ui.focus;
  };


  Plugin.prototype._stop = function( e, params ) {
    this._callEvent('stop', e, params);
    if( this._isPrevented ) { this._cancel( e, params ); }
  };

  

  /* ==============================================================================

  Keyboard

  */
  Plugin.prototype._keyHandler = function( e ) {

    if ( !this.options.keyboard ) { return; }
    // If options for preventing plugin in html inputs and e.target is input, than return
    if ( this.options.preventInputs && e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') { return; }

    var key = e.which, // pressed key
      params = {},
      sibling,         // sibling element
      isAllSelect,     // flag that is all items is selected
      direction;       // next or previous (depends from pressed arrow up|down)

    // Key is released
    if (e.type === 'keyup') {
      if ( key === Plugin.keyCode.SHIFT ) {
        // Delete flags, that has been needed while SHIFT was held
        delete this._shiftModeAction; // while SHIFT is held
        delete this._keyModes.shift; // arrow key (UP,DOWN) which pressed first in SHIFT mode
      }
      return;
    }

    // If CTRL+A or CMD+A pressed and multi option is true
    if ( key === Plugin.keyCode.A && (e.metaKey || e.ctrlKey) && this.options.multi ) {
      /* Prevent — bacause it's strange and annoying behavior 
      when first select all items in the list, and after that 
      if hold ctrl+A longer — select all text on that page */
      e.preventDefault();

      // Get all items
      sibling = this._getItems( this.options );
      // Set flag, that all items selected
      isAllSelect = true;

    } else {
      // Choose derection and try to find targeted item
      switch ( key ) {
      case Plugin.keyCode.HOME:
        direction = 'prev';
        sibling = this._getItems( this.options, 'first');
        break;

      case Plugin.keyCode.END:
        direction = 'next';
        sibling = this._getItems( this.options, 'last');
        break;

      case Plugin.keyCode.DOWN:
        direction = 'next';
        sibling = this._findNextSibling( 'next' );
        break;

      case Plugin.keyCode.UP:
        direction = 'prev';
        sibling = this._findNextSibling( 'prev' );
        break;

      // case Plugin.keyCode.PAGE_DOWN:
      //   direction = 'next';
      //   sibling = this._findNextSibling( 'pagedown' );
      //   break;

      // case Plugin.keyCode.PAGE_UP:
      //   direction = 'prev';
      //   sibling = this._findNextSibling( 'pageup' );
      //   break;
      }
    }

    // If sibling has found, that one of the arrows was pressed
    if ( sibling && sibling.length > 0 ) {

      // Disable default window scroll by arrow keys
      e.preventDefault();

      // Set target to found sibling item
      params.target = sibling[0];
      params.items = sibling;

      // If focus exists and SHIFT pressed and multi option is ON
      if ( this.ui.focus && this.options.multi && e.shiftKey && !isAllSelect ) {
        // Call multiVariator – it set all needed flags depends from arguments
        this._multiVariator( e, params, key, direction, sibling );

        // If there is no SHIFT action (first pressing arrow key with holding SHIFT)
        // Set mode of selection
        if ( !this._shiftModeAction ) { this._shiftModeAction = 'select'; }

        // If there is no SHIFT key mode (first pressing arrow key with holding SHIFT)
        // Set pressed arrow key
        if ( !this._keyModes.shift ) { this._keyModes.shift = key; }

        if ( key === Plugin.keyCode.END || key === Plugin.keyCode.HOME ) {
          // Get range of items and turn on range select mode
          params.items = this._rangeSelect( params );

        // Mode of multiply selection
        } else {
          params.isMultiSelect = true;
        }
      }

      // There are all necessary attributes now
      // Call _controller
      this._controller( e, params );

      // Recalculate plugin's box and window's scrolls
      if (this.ui.focus) {
        if ( this._scrolledElem ) { this._recalcBoxScroll( this._scrolledElem ); }
        this._recalcBoxScroll( window );
      }
    }
    return e;
  };


  /*  FOR SHIFT MODE ONLY
  *   - turns on shift mode flags
  *   - solves different situations with shift+arrows selection
  */
  Plugin.prototype._multiVariator = function( e, params, key, direction, sibling ) {
    var
      // Check if focus or target is selected
      isFocusSelected      = this._getIsSelected( this.ui.focus ),
      isTargetSelected     = this._getIsSelected( params.target ),
      // Search for next sibling in the same direction
      secSibling           = this._getItems( this.options, direction, sibling ),
      // Check if second sibling is selected (flag)
      isSelectedSecSibling = this._getIsSelected( secSibling );

    // If another arrow was pressed that means the direction was changed
    if ( this._keyModes.shift && this._keyModes.shift !== key ) {
      this._keyModes.shift = this._shiftModeAction = null;
    }

    // --------------------------
    // CHAIN OF CONDITIONS
    // TODO: do chain of conditions more clear and readable

    // Focus is not selected, target is selected and selected items more than one
    if ( !isFocusSelected && isTargetSelected && this._selected > 1 ) {
      // Nothing to do:
      // - Focus and target already exist
      // - After this chain _rangeSelect or _isMultiSelect mode will be set
      return;

    // If it serial selection of items by arrow key and target is already selected
    } else if ( this._keyModes.shift && this._shiftModeAction === 'select' && isTargetSelected ) {

      /* When user select range of items by holding SHIFT and presses arrow key,
      there are already can be selected items — than focus should jump
      through these selected items to first unselected item */

      // While first unselected item will be found or edge of the list will be reached
      while( this._getIsSelected(params.items) && params.items.length > 0 ) {
        // get next item in the same direction
        params.items = this._getItems( this.options, direction, params.items );
      }

      // If unselected item was found it becomes target item
      // target will be selected and get the focus
      if ( params.items.length > 0 ) { params.target = params.items; }
      

    // If target and focus is selected, but next item to the target is not:
    } else if ( isTargetSelected && isFocusSelected && !isSelectedSecSibling ) {
      /* Sitiation is possible when user unselect items 
      by arrow key with holding SHIFT */

      // Clear flags of serial selection by SHIFT
      this._keyModes.shift = this._shiftModeAction = null;
      params.items = this.ui.focus;
      // Selection will be clear on the focus
      // focus will be set on target item

    // The focus and target is selected
    } else if ( isFocusSelected && isTargetSelected ) {
      params.items = this.ui.focus;

      // If there is no SHIFT action (first pressing arrow key with holding SHIFT)
      // Set mode of selection
      if ( !this._shiftModeAction ) { this._shiftModeAction = 'unselect'; }
      // Selection will be clear on the focus
      // focus will be set on target item

    // Only target selected
    } else if ( !isFocusSelected && isTargetSelected ) {
      params.items = this.ui.focus;
      params.isTargetWasSelected = false;
      // The focus will be selected
      // The focus will be set on target item

    // Nothing is selected
    } else if ( !isFocusSelected && !isTargetSelected ) {
      params.target = params.items = this.ui.focus;
      // Focus will be selected
    }
    // END CHAIN OF CONDITIONS
    // ---------------------------
  };


  /*
  Used by _keyHandler
  when UP or DOWN keys was pressed — find next item or first/last of the list
  direction – next|prev
  */
  Plugin.prototype._findNextSibling = function( direction ) {
    var edge = ( direction === 'next' || direction === "pagedown" ) ? 'first' : 'last', // extreme item of the list
      // If there is the focus - try to find next sibling
      // else get first|last item of the list — depends from direction
      res = ( this.ui.focus ) ? this._getItems( this.options, direction, this.ui.focus ) : this._getItems( this.options, edge );

    // If has not found any items and loop option is ON
    if ( (res === null || res.length === 0) && this.options.loop ) {
      // find extreme item
      res = this._getItems( this.options, edge );
    }
    return res;
  };


  /*
  Used by _keyHandler
  Recalculate scroll position, if focused item is not visible in container viewport
  */
  Plugin.prototype._recalcBoxScroll = function( box ) {
    var
      $box          = $( box ),
      isWindow      = box === window,
      boxViewHeight = isWindow ? $box.outerHeight() : box.clientHeight,
      boxScrollTop  = $box.scrollTop(),
      boxWindowY    = isWindow ? 0 : $box.offset().top,

      $item         = $( this.ui.focus ),
      itemHeight    = $item.outerHeight(),
      itemBoxTop    = isWindow ? $item.offset().top : ( $item.offset().top - boxWindowY + boxScrollTop );

    if ( itemBoxTop < boxScrollTop ) {
      // Scroll to top edge of elem
      $box.scrollTop( itemBoxTop );
    
    } else if ( (itemBoxTop + itemHeight) > (boxScrollTop + boxViewHeight) ) {
      // Scroll to bottom edge of elem - 
      // bottom edges of item and viewport will be on the same Y
      $box.scrollTop( itemBoxTop + itemHeight - boxViewHeight );
    }
  };



  /* ==============================================================================

  Mouse

  */
  // Mouse events handler - set necessary paramaters and calls _controller
  Plugin.prototype._mouseHandler = function( e ) {
    var options = this.options,
    params = {};

    // If hybrid mode
    if ( options.event === 'hybrid' ) {

      // It is click and mouse was not pressed on item
      if ( e.type === 'click' && !this._mouseDownMode ) { return; }

      params.target = this._getTarget(e);

      if ( params.target && e.type === 'mousedown' ) {

        params.isTargetWasSelected = this._getIsSelected( params.target );
        if ( params.isTargetWasSelected ) {
          this._mouseDownMode = true;
          return;
        }
      }

      // If mouse down mode
      if ( this._mouseDownMode ) { delete this._mouseDownMode; }

    // if type of event do not match
    } else if ( e.type !== options.event ) {
      return;

    // Get target
    } else { params.target = this._getTarget(e); }

    // If multi options is true and target exists
    if( options.multi && params.target ) {

      // Range select
      if ( (e.shiftKey || e.shiftKey && e.ctrlKey) && this.ui.focus ) {
        params.items = this._rangeSelect( params );

      // Add/subtract to selection
      } else if( e.ctrlKey || e.metaKey || options.mouseMode === 'toggle' ) {
        params.items = this._multiSelect( params );
      }
    }

    if ( params.target && !params.items ) { params.items = $( params.target ); }
    this._controller( e, params );
  };



  /* ==============================================================================

  Public API

  */
  Plugin._command = function( options ) {
    var
      pluginObject = Plugin.getDataObject( this ),
      apiMethod, selector;

    if( null === pluginObject || void 0 === pluginObject ) {
      throw new Error( 'Element ' + this[0] + ' has no plugin ' + Plugin.pluginName );
    }

    // Try to find method
    if ( pluginObject[options] && $.isFunction(pluginObject[options]) ) {
      apiMethod = pluginObject[options];
    }

    // If method exists and it is not private – call him
    if ( apiMethod && $.isFunction( apiMethod ) && options.charAt(0) !== '_' ) {
      return apiMethod.apply( pluginObject, arguments );
    }

    // If received DOM element
    if ( options && options.addClass || options.nodeType ) {
      return pluginObject.select(
        // Filter received elements through cached selecter
        $( options ).filter( pluginObject.options.parentSelector )
      );
    }

    // Test for selector
    selector = this
      .find( options ) // Try to find
      .filter( pluginObject.options.parentSelector ); // Filter found elements

    // If there is jquery object:
    if( selector.jquery ) {
      // Call select method and give him elements
      if (selector.length > 0) { return pluginObject.select( selector ); }
      return this;
    }

    // Nothing has found
    throw new Error( 'Plugin \"' + Plugin.pluginName + '\" has no method \"' + options + '\"' );
  };


  Plugin.prototype.isEnabled = function() {
    return this._isEnable;
  };


  Plugin.prototype.option = function() {
    var secArg = arguments[1], arg = arguments.length;

    // Received two strings
    if( arg > 1 && secArg.charAt ) {
      // Received two strings and any argument
      if( arg > 2 ) {
        this._setOptions( secArg, arguments[2] );
        return this.$el;
      }
      // Return value of option
      return this.options[secArg];
    }

    // Received string and object
    if( arg > 1 && $.isPlainObject( secArg ) ) {
      this._setOptions( secArg );
      return this.$el;
    }

    // Return whole options object
    if (arg === 1) {
      return $.extend({}, this.options);
    } else {
      throw new Error('Format of \"option\" could be: \"option\" | \"option\", \"name\" | \"option\", \"name\", val | \"option\", {...}');
    }
  };


  Plugin.prototype.destroy = function() {
    this._destroy();
    this.$el.removeData( 'plugin_' + Plugin.pluginName );
    this.$el = null;
    return;
  };


  Plugin.prototype.select = function( elem ) {
    var params = {};

    // Set params for _controller method:
    params.items = ( elem.addClass ) ? elem : $( elem );
    params.target = elem[0] || elem;

    // Call _controller with null instead of event object
    this._controller( null, params );
    return this.$el;
  };


  Plugin.prototype.blur = function() {
    var params = {};
    // If target is not exist, _blur will be called
    params.target = null;
    // Call _controller with null instead of event object
    this._controller( null, params );
    return this.$el;
  };


  Plugin.prototype.getSelected = function() {
    return this._getSelected();
  };


  Plugin.prototype.getSelectedId = function() {
    return this._getSelected( true );
  };


  Plugin.prototype.getFocused = function() {
    if (this.ui.focus) {
      return this.ui.focus;
    } else {
      return null;
    }
  };


  Plugin.prototype.enable = function() {
    this._isEnable = true;
    this.$el.removeClass( this.options.disabledClass );
    return this.$el;
  };


  Plugin.prototype.disable = function() {
    this._isEnable = false;
    this.$el.addClass( this.options.disabledClass );
    return this.$el;
  };


  Plugin.prototype.cancel = function() {
    this._prevent();
    return this.$el;
  };


  Plugin.prototype.refresh = function() {

    var focus = this.ui.focus;

    // Check if focus is visible
    if ( focus && !$(focus).is(':visible') ) { delete this.ui.focus; }

    // Recalculate amount of selected items
    this._selected = ( this.getSelected() ).length;
    return this.$el;
  };



  /* ==============================================================================

  Method of jQuery.fn

  */
  $.fn[Plugin.pluginName] = function( options ) {

    // If string passed
    if( options && options.charAt ) {
      return Plugin._command.apply( this, arguments );
    }

    // DOM element passed
    else if ( options && (options.addClass || options.parentNode) ) {
      return Plugin._command.call( this, options );
    }

    // Create instances
    return this.each( function(key, elem) {
      if ( !Plugin.getDataObject(elem) ) { new Plugin( elem, options ); }
    });
  };





  /* DEVELOPMENT */
  window[ '_' + Plugin.pluginName ] = Plugin;





}(jQuery, window));