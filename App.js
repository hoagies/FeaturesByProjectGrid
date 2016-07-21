Ext.define('App.Constants', {
	singleton: true,
	GRID_COLUMNS: 4
});

Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
	title: 'BPO Portfolio View by Domain',
	requires: ['App.Constants'],
	launch: function() {

		this.add({
			xtype: 'rallyownerfilter',
			itemId: 'ownerComboBox',
			fieldLabel: 'Initiative Owner:',
			stateful: true,
			stateId: this.getContext().getScopedStateId('ownercombobox'),
			model: 'PortfolioItem/Initiative',
			listeners: {
				select: this._onLoad,
				ready: this._onLoad,
				scope: this
			}
		});
	},
	
	_onLoad: function(){
		
		// Parent Container
		if (this.down('#container')) {
			this.down('#container').destroy();
		}
		var panel = new Ext.Panel({
			id: 'container',
			// autoScroll: true,
			// title: 'Initiatives',
			layout: {
				type: 'accordion',
				titleCollapse: true,
				animate: true,
				// activeOnTop: true,
				multi: true
			},
			pack: 'start',
			// collapsible: true,
			defaults: {
				bodyStyle: 'padding:15px;'
			}
		});
		this.add(panel);
		panel.doLayout();
		
		var initiativeStore = Ext.create('Rally.data.WsapiDataStore', {
			model: 'PortfolioItem/Initiative',
			pageSize: 200,
			limit: Infinity,
			autoLoad: true,
			filters: [this._getOwnerFilter()],
			listeners: {
				load: function(store, data) {
					this._onInitiativesLoaded(store, data);
				},
				scope: this
			}
		});
	},
	
	_onInitiativesLoaded: function(store, data){
		
		var that = this;
		var containerPanel = that.down('#container');

		// Loop through each Initiative
		Ext.Array.each(data, function(record) {
			// Create Initiative Row Panel
			var id = record.get('FormattedID');
			var title = id + ' - ' + record.get('Name');
			var rowPanel = new Ext.Panel({
				title: title,
				ui: 'initiative',
				layout: {
					type: 'vbox',
					align: 'stretch'
				}
			});

			containerPanel.add(rowPanel);
			containerPanel.doLayout();

			var featureStore = Ext.create('Rally.data.WsapiDataStore', {
				model: 'PortfolioItem/Feature',
				pageSize: 200,
				limit: Infinity,
				autoLoad: true,
				filters: [
					{
						property: 'Parent.Parent.FormattedID',
						operator: '=',
						value: id
					}
				],
				listeners: {
					load: function(store, data) {
						that._onFeaturesLoaded(store, record, rowPanel);
					},
					scope: this
				}
			});
		});
	},
	
	_onFeaturesLoaded: function(store, initiative, rowPanel){
		
		// Get Distinct Projects from Feature Store
		var projectNames = _.map(store.getRange(), function(record) {
// 			return record.get('Project').Name;
            // var epicIDName = record.get('Parent').FormattedID + ' - ' + record.get('Parent').Name;
            var epicIDName = record.get('Parent').Name;
            return epicIDName;
		}),
			uniqueProjectNames = _.uniq(projectNames);
		
		// Set number of columns (grids) per row
		var columns = App.Constants.GRID_COLUMNS;
		var splitDomains = this._splitArray(uniqueProjectNames,columns);

		// Create Grid Panels for Domain
		var id = initiative.get('FormattedID');
		var items = this._getItems(splitDomains,id);
		rowPanel.add(items);
		rowPanel.doLayout();
	},
	
	_splitArray: function (unsplitArray, size) {
		var splitArray = [];
		while (unsplitArray.length > 0)
		splitArray.push(unsplitArray.splice(0, size));
		return splitArray;
	},
	
	_getItems: function(splitDomains,id) {
		var gridRows = [];
		var that = this;
		Ext.Array.each(splitDomains, function(record) {
			gridRows.push(
				{
					xtype: 'container',
					layout: {
						type: 'hbox',
						align: 'stretch'
					},
					height: 175,
					items	: that._getItems2(record,id)
				}
			);
		});
		return gridRows;
	},
	
	_getItems2: function(records,id){
		var that = this;
		var gridPanels = [];
		
		Ext.Array.each(records, function(record) {
			gridPanels.push(
				{
					title	: record,
					flex	: 2,
					autoScroll: true,
					items	: [
						{
							xtype: 'rallygrid',
							header: false,
							width: '95%',
							columnCfgs: [
								{
									text: 'ID', dataIndex: 'FormattedID', flex: 10
								},
								{
									text: 'State', dataIndex: 'State', flex: 10
								},
								{
									text: '% Done (pts)', dataIndex: 'PercentDoneByStoryPlanEstimate', flex: 10
								}, 
						        {
									text: 'Color', dataIndex: 'DisplayColor', flex: 10
								}
							],
							enableEditing: false,
							showRowActionsColumn: false,
							// showPagingToolbar: false,
							storeConfig: {
								model: 'portfolioitem/feature',
								pageSize: 200,
								filters: [that._getFilterGrid(record,id)],
								sorters: [
                					{
                				// 		property: 'PercentDoneByStoryPlanEstimate',
                				        property: 'State',
                						direction: 'DESC'
                					},
            					],
                            // 	remoteGroup: false,
                				// remoteSort: false,
                				// remoteFilter: false,
                				limit: Infinity,
							},
							// For Tooltip (12/1/2015)
							listeners: {
								itemclick: function(g, record, item) {
									tooltipvalue = record.get('FormattedID') + ' - ' + record.get('Name');
									Ext.create('Rally.ui.tooltip.ToolTip', {
										target : item,
										destroyAfterHide: true,
										// hideDelay: 0,
										html: '<p><strong>' + tooltipvalue + '</strong></p>'
									}).showNow();
								}
								// select: this._getRecordOnSelectedRow,
								// load : function(g, record, index, options){
									// this._getRecordOnSelectedRow(g, record, 0, options);
								// },
								// scope: this
							}
						}
					]
				}
			);
		});
		// Create Empty Boxes
		var i = records.length;
		while (i < App.Constants.GRID_COLUMNS){
			gridPanels.push(
				{
					ui: 'empty',
					flex	: 2,
					border	: true
				}
			);
			i++;
		}
		return gridPanels;
		
	},

	_getFilterGrid: function(record,id) {
		var combo = this.down('rallycombobox');
		var filters = Ext.create('Rally.data.QueryFilter', {
			property: 'Parent.Parent.FormattedID',
			operator: '=',
			value: id
		});
		
		filters = filters.and(Ext.create('Rally.data.QueryFilter', {
// 			property: 'Project.Name',
            property: 'Parent.Name',
			operator: '=',
			value: record
		}));
		return filters;
	},
	
	_getOwnerFilter: function() {
		combo = this.down('#ownerComboBox');
		var comboval = combo.getValue();
		if(!comboval){
			comboval = combo.stateValue;
		}
		if(String(comboval).indexOf('-1') > -1){
			comboval = null;
		}
		return {
			property: 'Owner',
			operator: '=',
			value: comboval
		};
	},

	// SPH Test This (12/1/2015)
	_getRecordOnSelectedRow:function(g, record, rowIndex, options){
        console.log(record);
    }
	
});