// Adapted examples from Open Intelligent UI. MIT; see LICENSE.
export const exampleShoppingList = `root = Card([title, stepper, list, copy])
$guests = 4
$got = []
title = Title("Pasta night for " + @Plural($guests, "guest"), "lg")
stepper = Row([IconButton("minus", @Set($guests, @Clamp($guests - 1, 1, 20)), "Fewer"), Text($guests + "", "lg", null, "semibold"), IconButton("plus", @Set($guests, @Clamp($guests + 1, 1, 20)), "More")], 3)
lines = @Each(base, "i", {name: i.name, qty: @Round(i.qty * $guests / 4) + i.unit})
list = Col(@Each(lines, "l", Pressable([Row([Icon(@Includes($got, l.name) ? "check-circle" : "circle", "sm"), Text(l.qty + " " + l.name, "sm", null, null, false, @Includes($got, l.name))], 2)], @Set($got, @Toggle($got, l.name)), @Includes($got, l.name), 2)), 1)
copy = Button("Copy list", @CopyToClipboard(@Join(@Each(lines, "l", l.qty + " " + l.name), "\\n")), "outline", null, "sm", "copy")
base = [{name: "spaghetti", qty: 400, unit: " g"}, {name: "tomatoes", qty: 6, unit: ""}, {name: "parmesan", qty: 80, unit: " g"}]`;

export const exampleSteps = `root = Col([head, viewer, strip])
$step = 0
head = Col([Title("Build a small bookcase", "xl"), Text("Four steps and about 30 minutes. You need the Allen key from the box and a hammer.", "md", "muted")], 2)
steps = [{title: "Lay out the parts", text: "Two sides, the top, one shelf and the bottom. Tap the 12 wooden dowels into the holes on the sides."}, {title: "Fix the boards to one side", text: "Push the top, shelf and bottom onto one side's dowels, then turn each cam lock clockwise until it pulls tight."}, {title: "Add the other side", text: "Fit the second side onto the free dowels and tighten its cam locks the same way."}, {title: "Nail on the back", text: "Lay it face down, check the corners are square, then nail the back panel about every 10 cm."}]
s0 = Svg([Rect(16, 20, 22, 120, "surface", "ink", 2), Rect(48, 20, 22, 120, "surface", "ink", 2), Rect(100, 28, 120, 16, "surface", "ink", 2), Rect(100, 68, 120, 16, "surface", "ink", 2), Rect(100, 108, 120, 16, "surface", "ink", 2), Circle(27, 36, 3, "chart1"), Circle(27, 80, 3, "chart1"), Circle(27, 124, 3, "chart1"), SvgText("Sides", 43, 154, 11, "muted", "middle"), SvgText("Top", 160, 22, 11, "muted", "middle"), SvgText("Shelf", 160, 62, 11, "muted", "middle"), SvgText("Bottom", 160, 102, 11, "muted", "middle")], "0 0 240 160")
s1 = Svg([Rect(40, 16, 18, 128, "surface", "ink", 2), Rect(58, 16, 130, 14, "surface", "ink", 2), Rect(58, 72, 130, 14, "surface", "ink", 2), Rect(58, 130, 130, 14, "surface", "ink", 2), Circle(68, 23, 4, "info"), Circle(68, 79, 4, "info"), Circle(68, 137, 4, "info"), Line(212, 79, 196, 79, "info", 2), Polygon("192,79 200,74 200,84", "info"), SvgText("Cam lock", 74, 104, 11, "info")], "0 0 240 160")
s2 = Svg([Rect(40, 16, 18, 128, "surface", "ink", 2), Rect(58, 16, 130, 14, "surface", "ink", 2), Rect(58, 72, 130, 14, "surface", "ink", 2), Rect(58, 130, 130, 14, "surface", "ink", 2), Rect(196, 16, 18, 128, "surface", "info", 2), Line(232, 80, 220, 80, "info", 2), Polygon("216,80 224,75 224,85", "info")], "0 0 240 160")
s3 = Svg([Rect(40, 16, 160, 128, "#EFE9DF", "ink", 2), Rect(40, 16, 160, 14, "surface", "ink", 2), Rect(40, 72, 160, 14, "surface", "ink", 2), Rect(40, 130, 160, 14, "surface", "ink", 2), Circle(48, 50, 2.5, "ink"), Circle(192, 50, 2.5, "ink"), Circle(48, 108, 2.5, "ink"), Circle(192, 108, 2.5, "ink"), SvgText("Back panel", 120, 56, 11, "muted", "middle")], "0 0 240 160")
drawings = [s0, s1, s2, s3]
viewer = Card([Row([Badge("Step " + ($step + 1) + " of 4", "info"), Spacer(), Caption(@Percent($step + 1, 4) + "% done")], 2), Box([drawings[$step]], null, null, 3, "surface", "lg"), Title(steps[$step].title, "md"), Text(steps[$step].text, "sm"), Row([Button("Back", @Set($step, @Clamp($step - 1, 0, 3)), "outline", null, null, "arrow-left", $step == 0), Spacer(), Button("Next step", @Set($step, @Clamp($step + 1, 0, 3)), "solid", null, null, "arrow-right", $step == 3)], 2)], null, 4, 3)
strip = Grid(@Each(@Range(0, 4), "i", Pressable([drawings[i], Caption((i + 1) + ". " + steps[i].title)], @Set($step, i), i == $step, 2)), 4, 110, 2)`;

export const exampleDashboard = `root = Col([head, Caption("合成示例数据 · 非真实业务数据"), kpis, Grid([weekly, byRegion], 2, 280, 4), top])
$region = "All"
orders = Query("get_orders", {days: 90}, {rows: []})
rows = $region == "All" ? orders.rows : @Filter(orders.rows, "region", "==", $region)
head = Row([Title("示例营收分析 · 最近 90 天", "lg"), Spacer(), SegmentedControl($region, ["All", "North", "South", "East", "West"])], 3, null, null, true)
kpis = Grid([Card([Caption("Revenue"), Title(@Format(@Sum(rows.amount), "compact", 1, "USD"), "xl")]), Card([Caption("Orders"), Title(@Format(@Count(rows)), "xl")])], 2, 160, 3)
weekly = Card([Title("Revenue by week", "sm"), Chart("line", @Bucket(rows, "date", "week", "amount"), "key", ["value"], "currency")])
byRegion = Card([Title("By region", "sm"), Chart("donut", @GroupBy(orders.rows, "region", "amount"), "key", ["value"], "currency")])
top = Table(["Product", "Revenue"], @Each(@Top(@GroupBy(rows, "product", "amount"), "value", 5), "p", [p.key, @Format(p.value, "currency")]))`;
