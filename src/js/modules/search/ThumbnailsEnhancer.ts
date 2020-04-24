import { Danbooru } from "../../components/api/Danbooru";
import { XM } from "../../components/api/XM";
import { PageDefintion } from "../../components/data/Page";
import { ModuleController } from "../../components/ModuleController";
import { RE6Module, Settings } from "../../components/RE6Module";
import { Util } from "../../components/structure/Util";

export enum ThumbnailPerformanceMode {
    Disabled = "disabled",
    Hover = "hover",
    Always = "always",
}

export enum ThumbnailClickAction {
    Disabled = "disabled",
    NewTab = "newtab",
    CopyID = "copyid",
}

export class ThumbnailEnhancer extends RE6Module {

    private postContainer: JQuery<HTMLElement>;
    private static zoomPaused = false;

    public constructor() {
        super([PageDefintion.search, PageDefintion.popular, PageDefintion.favorites]);
    }

    protected getDefaultSettings(): Settings {
        return {
            enabled: true,

            upscale: ThumbnailPerformanceMode.Hover,

            zoom: false,
            zoomScale: "2",
            zoomContextual: true,

            vote: true,

            crop: true,
            cropSize: "150px",
            cropRatio: "0.9",

            ribbons: true,
            relRibbons: true,

            clickAction: ThumbnailClickAction.NewTab,
        };
    }

    public create(): void {
        super.create();

        this.postContainer = $("div#posts-container");

        const upscaleMode: ThumbnailPerformanceMode = this.fetchSettings("upscale"),
            clickAction: ThumbnailClickAction = this.fetchSettings("clickAction");
        $("div#posts-container article.post-preview").each((index, element) => {
            ThumbnailEnhancer.modifyThumbnail($(element), upscaleMode, clickAction);
        });

        this.toggleHoverZoom(this.fetchSettings("zoom"));
        this.setZoomScale(this.fetchSettings("zoomScale"));
        this.toggleZoomContextual(this.fetchSettings("zoomContextual"));

        this.toggleHoverVote(this.fetchSettings("vote"));

        this.toggleThumbCrop(this.fetchSettings("crop"));
        this.setThumbSize(this.fetchSettings("cropSize"));
        this.setThumbRatio(this.fetchSettings("cropRatio"));

        this.toggleStatusRibbons(this.fetchSettings("ribbons"));
        this.toggleRelationRibbons(this.fetchSettings("relRibbons"));
    }

    /**
     * Enables the zoom-on-hover functionality
     * @param state True to enable, false to disable
     */
    public toggleHoverZoom(state = true): void {
        this.postContainer.attr("data-thumb-zoom", state + "");
    }

    /**
     * Sets the ratio by which the thumbnail is scaled on hover
     * @param scale Value, above zero, below 10 (?)
     */
    public setZoomScale(scale: string): void {
        this.postContainer.css("--thumbnail-zoom", scale);
    }

    /**
     * Toggles the contextual zoom
     * @param state True to enable, false to suppress
     */
    public toggleZoomContextual(state = true): void {
        this.postContainer.attr("data-thumb-zoom-context", state + "");
    }

    /**
     * Enables the zoom-on-hover functionality
     * @param state True to enable, false to disable
     */
    public toggleHoverVote(state = true): void {
        this.postContainer.attr("data-thumb-vote", state + "");
    }

    /**
     * Crops the thumbnails to squares to minimize empty space
     * @param state True to crop, false to restore
     */
    public toggleThumbCrop(state = true): void {
        this.postContainer.attr("data-thumb-crop", state + "");
    }

    /**
     * Sets the thumbnail width. Does not support percent values.
     * @param size Value, in pixels, em, rem, whatever
     */
    public setThumbSize(size: string): void {
        this.postContainer.css("--thumbnail-size", size);
    }

    /**
     * Sets the height to width ratio for the thumbnail
     * @param ratio Value, from 0 to 2
     */
    public setThumbRatio(ratio: string): void {
        this.postContainer.css("--thumbnail-ratio", ratio);
    }

    /**
     * Toggles the post flag ribbons
     * @param state True to enable, false to disable
     */
    public toggleStatusRibbons(state = true): void {
        this.postContainer.attr("data-thumb-ribbons", state + "");
    }

    /**
     * Toggles the post relation ribbons
     * @param state True to enable, false to disable
     */
    public toggleRelationRibbons(state = true): void {
        this.postContainer.attr("data-thumb-rel-ribbons", state + "");
    }

    /**
     * Pauses or unpauses ThumbnailEnhancer's hover actions
     * @param state True to hide, false to restore
     */
    public static pauseHoverActions(zoomPaused = true): void {
        if (zoomPaused) $("div#posts-container").attr({ "data-thumb-zoom": "false", "data-thumb-vote": "false", });
        else {
            const module = ModuleController.get(ThumbnailEnhancer);
            $("div#posts-container").attr({
                "data-thumb-zoom": module.fetchSettings("zoom"),
                "data-thumb-vote": module.fetchSettings("vote"),
            });
        }

        ThumbnailEnhancer.zoomPaused = zoomPaused;
    }

    /**
     * Converts the thumbnail into an enhancer-ready format
     * @param $article JQuery element `article.post-preview`
     * @param upscaleMode If / when to load upscaled versions of the image
     */
    public static modifyThumbnail($article: JQuery<HTMLElement>, upscaleMode = ThumbnailPerformanceMode.Hover, clickAction = ThumbnailClickAction.NewTab): void {

        /* Create the structure */
        const $link = $article.find("a.preview-box"),
            postID = parseInt($article.attr("data-id")),
            $picture = $article.find("picture"),
            $img = $article.find("img"),
            $imgData = $img.attr("title").split("\n").slice(0, -2);     // Replace if the post date is added for the data-attributes.

        $article.find("source").remove();                               // If we ever have to worry about mobile users, this will need to be addressed.
        $img.removeAttr("title").attr("alt", "#" + $article.attr("data-id"));

        // Loading icon
        $("<div>")
            .addClass("preview-load")
            .html(`<i class="fas fa-circle-notch fa-2x fa-spin"></i>`)
            .appendTo($link);

        // States and Ribbons
        $picture.addClass("picture-container");

        // States
        const state = $("<div>")
            .addClass("rel-ribbon")
            .append($("<span>"))
            .appendTo($picture);
        let stateText = "";

        if ($article.hasClass("post-status-has-children")) {
            state.addClass("thumb-ribbon thumb-ribbon-has-children");
            stateText += "Child posts\n"
        }
        if ($article.hasClass("post-status-has-parent")) {
            state.addClass("thumb-ribbon thumb-ribbon-has-parent");
            stateText += "Parent posts\n"
        }

        if (state.hasClass("thumb-ribbon")) { state.addClass("left").attr("title", stateText); }
        else { state.remove(); }

        // Ribbons
        const ribbon = $("<div>")
            .addClass("flag-ribbon")
            .append($("<span>"))
            .appendTo($picture);
        let ribbonText = "";

        if ($article.hasClass("post-status-flagged")) {
            ribbon.addClass("thumb-ribbon thumb-ribbon-flagged");
            ribbonText += "Flagged\n"
        }
        if ($article.hasClass("post-status-pending")) {
            ribbon.addClass("thumb-ribbon thumb-ribbon-pending");
            ribbonText += "Pending\n"
        }

        if (ribbon.hasClass("thumb-ribbon")) { ribbon.addClass("right").attr("title", ribbonText); }
        else { ribbon.remove(); }

        // Description box that only shows up on hover
        const $extrasBox = $("<div>")
            .addClass("bg-highlight preview-extras")
            .appendTo($link);
        $("<span>").html($imgData[4]).appendTo($extrasBox);
        $("<span>").html(parseRating($imgData[0])).appendTo($extrasBox);
        $("<span>").html(parseDate($imgData[2])).appendTo($extrasBox);

        // Voting Buttons
        const $voteBox = $("<div>")
            .addClass("preview-voting")
            .appendTo($link);
        const $voteUp = $("<button>")        // Upvote
            .attr("href", "#")
            .html(`<i class="far fa-thumbs-up"></i>`)
            .addClass("button score-neutral voteButton post-vote-up-" + postID)
            .appendTo($voteBox);
        const $voteDown = $("<button>")        // Downvote
            .attr("href", "#")
            .html(`<i class="far fa-thumbs-down"></i>`)
            .addClass("button score-neutral voteButton post-vote-down-" + postID)
            .appendTo($voteBox);
        /*
        $("<button>")        // Favorite
            .attr("href", "#")
            .html(`<i class="far fa-star"></i>`)
            .addClass("button score-neutral voteButton")
            .appendTo($voteBox);
        */

        $voteUp.click((event) => {
            event.preventDefault();
            Danbooru.Post.vote(postID, 1);
        });
        $voteDown.click((event) => {
            event.preventDefault();
            Danbooru.Post.vote(postID, -1);
        });


        /* Handle double-click */
        let dbclickTimer: number;
        const delay = 200;
        let prevent = false;

        //Make it so that the doubleclick prevents the normal click event
        $link.on("click.re621.thumbnail", (event) => {
            if (
                // Ignore mouse clicks which are not left clicks
                (event.button !== 0) ||
                // Stop keeping track of double clicks if the zoom is paused
                (ThumbnailEnhancer.zoomPaused) ||
                // Make sure the click does not get triggered on the voting buttons
                ($(event.target).hasClass("voteButton") || $(event.target).parent().hasClass("voteButton"))
            ) { return; }

            event.preventDefault();

            dbclickTimer = window.setTimeout(() => {
                if (!prevent) {
                    $link.off("click.re621.thumbnail");
                    $link[0].click();
                }
                prevent = false;
            }, delay);
        }).on("dblclick.re621.thumbnail", (event) => {
            if (
                // Ignore mouse clicks which are not left clicks
                (event.button !== 0) ||
                // Stop keeping track of double clicks if the zoom is paused
                (ThumbnailEnhancer.zoomPaused) ||
                // Make sure the click does not get triggered on the voting buttons
                ($(event.target).hasClass("voteButton") || $(event.target).parent().hasClass("voteButton"))
            ) { return; }

            event.preventDefault();
            window.clearTimeout(dbclickTimer);
            prevent = true;

            $article.addClass("highlight");
            window.setTimeout(() => $article.removeClass("highlight"), 250);

            if (clickAction === ThumbnailClickAction.NewTab) XM.Util.openInTab(window.location.origin + $link.attr("href"));
            else if (clickAction === ThumbnailClickAction.CopyID) XM.Util.setClipboard($article.attr("data-id"), "text");
            else {
                $link.off("click.re621.thumbnail");
                $link[0].click();
            }
        });


        /* Load the larger images */
        if ($article.attr("data-file-ext") === "swf" || $article.attr("data-flags") === "deleted") {
            // Replace placeholder images with CSS-styled ones

            $img.attr("src", "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==");
            $picture.addClass("color-text post-placeholder")

            if ($article.attr("data-file-ext") === "swf") $picture.addClass("flash");
            if ($article.attr("data-flags") === "deleted") $picture.addClass("deleted");

        } else {
            // Add dynamically-loaded highres thumbnails

            const sampleURL = $article.attr("data-large-file-url");

            if (upscaleMode === ThumbnailPerformanceMode.Hover) {
                let timer: number;
                $article.on("mouseenter", () => {
                    if (ThumbnailEnhancer.zoomPaused) return;

                    // only load sample after a bit of waiting
                    // this prevents loading images just by hovering over them to get to another one
                    timer = window.setTimeout(() => {
                        if ($img.attr("data-src") == sampleURL) return;

                        $link.addClass("loading");
                        $img.attr("data-src", sampleURL)
                            .addClass("lazyload")
                            .one("lazyloaded", () => {
                                $link.removeClass("loading");
                                $article.addClass("loaded");
                            });
                    }, 200);
                });
                $article.on("mouseleave", () => {
                    window.clearTimeout(timer);
                });
            } else if (upscaleMode === ThumbnailPerformanceMode.Always) {
                $link.addClass("loading");
                $img.attr("data-src", sampleURL)
                    .addClass("lazyload")
                    .one("lazyloaded", () => {
                        $link.removeClass("loading");
                        $article.addClass("loaded");
                    });
            }

        }

        function parseRating(input: string): string {
            switch (input) {
                case "Rating: e": return "Explicit";
                case "Rating: q": return "Questionable";
                case "Rating: s": return "Safe";
                default: return "Unknown";
            }
        }

        function parseDate(input: string): string {
            const date = new Date(input.split(": ").pop().replace(" ", "T").replace(" ", ""));
            return `<span title="` + date.toLocaleString() + `">` + Util.timeAgo(date) + `</span>`;
        }

    }

}
