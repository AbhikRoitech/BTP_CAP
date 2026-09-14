sap.ui.define([
    "sap/ui/core/mvc/Controller"
], (Controller) => {
    "use strict";

    return Controller.extend("mystore.controller.View1", {
        onInit() {
            this.getOwnerComponent().getRouter()
                .getRoute("RouteView1")
                .attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched() {
            this.byId("productsTable").getBinding("items").refresh();
        },

        onAddPress() {
            this.getOwnerComponent().getRouter().navTo("RouteView2", { objectId: "new" });
        },

        onItemPress(oEvent) {
            const oContext = oEvent.getSource().getBindingContext();
            const sObjectId = oContext.getProperty("ID");
            this.getOwnerComponent().getRouter().navTo("RouteView2", { objectId: sObjectId });
        }
    });
});
