var left = createSidebar(createDisplay("left"), { min: 20, max: 600 }, createPreferences("left", 222));
var center = createContentPane(createDisplay("center"), 560);
var right = createSidebar(createDisplay("right"), { min: 20, max: 500 }, createPreferences("right", 310));

var container = createLayoutContainer(center, [left, right]);
left.registerContainer(container);
right.registerContainer(container);

createDraggable("left", left, function(x) { return x; });
createDraggable("right", right, function(x) { return getWindowDimensions().width - x; });

var containerDiv = getElementById("container");
window.addEventListener("resize", function(e) {
    updateSize();
});

updateSize();

function updateSize() {
    var dims = getWindowDimensions();
    container.setWidth(dims.width);
    containerDiv.style.height = dims.height + "px";
}

function getElementById(id) {
    return document.getElementById(id);
}

function getWindowDimensions() {
    return {
        width: window.innerWidth,
        height: window.innerHeight
    };
}

function createDraggable(handleName, sidebar, mouseXToWidth) {
    var handleElement = getElementById("handle-" + handleName);
    handleElement.addEventListener("mousedown", function(e) {
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        onMouseMove(e);
    });
    handleElement.addEventListener("dblclick", function () {
        sidebar.toggleCollapsed();
    });

    function onMouseMove(e) {
        sidebar.changeWidth(mouseXToWidth(e.x));
    }

    function onMouseUp() {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        sidebar.save();
    }
}

function createDisplay(id) {
    var element = document.getElementById(id);
    return {
        update: function (info) {
            var width = info.width;
            var preferredWidth = info.preferredWidth;

            element.style.width = (Math.round(width * 100) / 100) + "px";
            var text = Math.round(width) + "";
            if (preferredWidth) {
                text += " / " + Math.round(preferredWidth);
            }
            var captionDisplay = element.querySelector(".caption") || element;
            captionDisplay.innerText = text;

            element.classList.toggle("collapsed", info.collapsed);
        }
    };
}

function createPreferences(prefix, defaultWidth) {
    var width = Number(localStorage.getItem(prefix + "_width")) || defaultWidth;
    var collapsed = localStorage.getItem(prefix + "_collapsed") === "true";

    function get(prop, type, defaultVal) {
        return type(localStorage.getItem(prefix + "_" + prop)) || defaultVal;
    }

    function set(prop, value) {
        localStorage.setItem(prefix + "_" + prop, value);
    }

    return {
        getWidth: function () {
            return width;
        },
        setWidth: function (value) {
            width = value;
            set("width", value);
        },
        isCollapsed: function () {
            return collapsed;
        },
        setCollapsed: function (value) {
            collapsed = value;
            set("collapsed", value);
        },
        getDefaultWidth: function () {
            return defaultWidth;
        }
    };
}

//---------------------------------------------------------------

function sum(array, getValue) {
    return array.reduce(function (sum, item) {
        return sum + getValue(item);
    }, 0);
}

function getPreferredWidth(item) {
    return item.getPreferredWidth();
}

function getMinWidth(item) {
    return item.getMinWidth();
}

function getWidth(item) {
    return item.getWidth();
}

function createLayoutContainer(contentPane, sidebars) {
    var containerWidth;
    
    var items = sidebars.concat([contentPane]);
    var minWidth = contentPane.getMinWidth() + sum(sidebars, getMinWidth);
    
    function updateWidths(availableWidth) {
        var totalPreferredWidth = sum(sidebars, getPreferredWidth);
        var minItemsWidth = contentPane.getMinWidth();
        var preferredMinWidth = totalPreferredWidth + minItemsWidth;

        if (preferredMinWidth > availableWidth) {
            var remainingSpace = availableWidth - minItemsWidth;
            var remainingPreferredWidth = totalPreferredWidth;
            var remainingMinimumWidth = sum(sidebars, getMinWidth);
            // ustawiamy tym, co nie mają preferowanej, minimalną
            contentPane.setWidth(contentPane.getMinWidth());

            // ustawiamy reszcie proporcjonalnie zmniejszoną preferowaną
            sidebars.forEach(function (sidebar) {
                remainingMinimumWidth -= sidebar.getMinWidth();
                var widthShare = sidebar.getPreferredWidth() / remainingPreferredWidth;
                var newWidth = Math.max(widthShare * remainingSpace, sidebar.getMinWidth());
                if (newWidth + remainingMinimumWidth > remainingSpace) {
                    newWidth = remainingSpace - remainingMinimumWidth;
                }
                sidebar.setWidth(newWidth);

                remainingSpace -= newWidth;
                remainingPreferredWidth -= sidebar.getPreferredWidth();
            });
        } else {
            // ustawiamy tym, co mają preferowaną, preferowaną
            sidebars.forEach(function (sidebar) {
                sidebar.setWidth(sidebar.getPreferredWidth());
            });
            // a tym, co nie mają, proporcjonalnie przydzielamy pozostałą przestrzeń
            contentPane.setWidth(availableWidth - totalPreferredWidth);
        }
    }
    
    return {
        changeSidebarWidth: function (changedSidebar, value) {
            var otherItems = sidebars.filter(function (sidebar) { return sidebar !== changedSidebar; });
            var otherItemsWidth = sum(otherItems, getWidth);
            
            var takenWidth = otherItemsWidth + Math.min(contentPane.getMinWidth(), contentPane.getWidth());
            
            value = Math.min(containerWidth - takenWidth, value);
            if (value >= changedSidebar.getMinWidth()) {
                changedSidebar.setWidth(value);
                var availableWidth = containerWidth - otherItemsWidth - value;
                contentPane.setWidth(availableWidth);
            }
        },
        setWidth: function (value) {
            containerWidth = value;
            if (minWidth > containerWidth) {
                // ustawiamy wszystkim proporcjonalnie do minimalnej szerokości
                items.forEach(function (item) {
                    item.setWidth(containerWidth * item.getMinWidth() / minWidth);
                });
            } else {
                updateWidths(containerWidth, sidebars);
            }
        }
    };
}

function createContentPane(display, minWidth) {
    var width;

    function draw() {
        display.update({ width: width });
    }

    return {
        setWidth: function (value) {
            width = value;
            draw();
        },
        getWidth: function () { return width; },
        getMinWidth: function () { return minWidth; },
    };
}

function createSidebar(display, constraints, preferences) {
    var UNCOLLAPSE_LIMIT = 5;

    var container;
    var width;
    var preferredWidth = preferences.getWidth();
    
    function draw() {
        display.update({
            width: width,
            preferredWidth: getPreferredWidth(),
            collapsed: !isWidthOverUncollapseLimit(width)
        });
    }

    function getPreferredWidth() {
        return preferences.isCollapsed() ? constraints.min : preferences.getWidth();
    }

    function isWidthOverUncollapseLimit(value) {
        return (value || width) > constraints.min + UNCOLLAPSE_LIMIT;
    }

    function savePreferences() {
        if (preferences.isCollapsed() && isWidthOverUncollapseLimit()) {
            preferences.setWidth(width);
            preferences.setCollapsed(false);
        } else if (!preferences.isCollapsed() && width >= constraints.min) {
            if (!isWidthOverUncollapseLimit()) {
                preferences.setCollapsed(true);
            } else {
                preferences.setWidth(width);
            }
        }
        draw();
    }

    function changeSidebarWidth(value) {
        value = Math.min(Math.max(value, constraints.min), constraints.max);
        container.changeSidebarWidth(sidebar, value);
    }

    var sidebar = {
        registerContainer: function (value) { container = value; },
        setWidth: function (value) {
            width = value;
            draw();
        },
        getWidth: function () { return width; },
        changeWidth: changeSidebarWidth,
        save: savePreferences,
        toggleCollapsed: function () {
            var collapsed = !preferences.isCollapsed();
            preferences.setCollapsed(collapsed);

            changeSidebarWidth(getPreferredWidth());
            draw();
        },
        getMinWidth: function () { return constraints.min; },
        getPreferredWidth: getPreferredWidth
    };

    return sidebar;
}
