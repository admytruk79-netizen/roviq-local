# ROVIQ Local — Approved UI Reference

The approved product design is a 3 × 2 matrix.

## Experience states
1. REST — beautiful at rest; the map is the hero. Quiet map, no POI clutter, location/search affordances only.
2. EXPLORE — touch wakes it; information appears with clarity. Curated category markers, user halo, Discover control, selected-place card and bottom navigation.
3. WILD — something special happens. Brief teal/gold honeycomb discovery treatment, one highlighted discovery, WILD discovery card.

## Visual themes
Each of REST, EXPLORE and WILD must work in both DAY and NIGHT. Day/night changes the basemap/ambient lighting only. It must never replace, rename, flatten or override REST/EXPLORE/WILD.

## Non-negotiable rendering rule
MapLibre is the authoritative renderer. Geographic marker outer elements are owned by MapLibre and must never receive CSS transforms for UI animation. Animate only marker inner content so locations stay geographically attached during pan, zoom, pitch and bearing changes.

## Visual language
Near-black/navy shell, warm antique gold map/UI linework, restrained teal for interaction/activation, editorial typography, generous negative space, no generic dashboard styling, no clutter.

This document records the supplied approved reference as the implementation target.