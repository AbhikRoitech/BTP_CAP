sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast"
], (Controller, MessageToast) => {
    "use strict";

    return Controller.extend("mystore.controller.View2", {
        onInit() {
            this.getOwnerComponent().getRouter()
                .getRoute("RouteView2")
                .attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched(oEvent) {
            const sObjectId = oEvent.getParameter("arguments").objectId;
            const oModel = this.getView().getModel();

            if (sObjectId === "new") {
                this._bCreateMode = true;
                const oListBinding = oModel.bindList("/Products");
                const oContext = oListBinding.create({});
                this.getView().setBindingContext(oContext);
            } else {
                this._bCreateMode = false;
                this.getView().bindElement({
                    path: `/Products('${sObjectId}')`
                });
            }
        },

        onSavePress() {
            this.getView().getModel().submitBatch("$auto")
                .then(() => {
                    MessageToast.show(this._getText("msgSaved"));
                    this._navBack();
                });
        },

        onDeletePress() {
            const oContext = this.getView().getBindingContext();
            oContext.delete()
                .then(() => {
                    MessageToast.show(this._getText("msgDeleted"));
                    this._navBack();
                });
        },

        onCancelPress() {
            const oContext = this.getView().getBindingContext();
            if (this._bCreateMode && oContext) {
                oContext.delete();
            }
            this._navBack();
        },

        onNavBackPress() {
            this.onCancelPress();
        },

        _getText(sKey) {
            return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText(sKey);
        },

        _navBack() {
            this.getOwnerComponent().getRouter().navTo("RouteView1");
        }
    });
});
