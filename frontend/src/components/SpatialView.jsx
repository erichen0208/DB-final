import React, { useRef, useEffect } from "react";
import * as d3 from "d3";

function SpatialView({ data, hoveredNode, showAllNodes }) {
  const svgRef = useRef();

  useEffect(() => {
    if (!data || (!data.treeNodes && !data.dataPoints)) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const container = svgRef.current.parentElement;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 400;
    const margin = { top: 30, right: 90, bottom: 50, left: 70 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Calculate bounds
    let xMin = 121.5,
      xMax = 121.6,
      yMin = 25.02,
      yMax = 25.1;

    if (data.target && data.target.min && data.target.max) {
      const padding = 0.005;
      xMin = Math.min(xMin, data.target.min[0] - padding);
      xMax = Math.max(xMax, data.target.max[0] + padding);
      yMin = Math.min(yMin, data.target.min[1] - padding);
      yMax = Math.max(yMax, data.target.max[1] + padding);
    }

    // Create scales
    const xScale = d3.scaleLinear().domain([xMin, xMax]).range([0, innerWidth]);
    const yScale = d3
      .scaleLinear()
      .domain([yMin, yMax])
      .range([innerHeight, 0]);

    // Create main group
    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Add axes
    g.append("g")
      .attr("transform", `translate(0, ${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(5).tickFormat(d3.format(".3f")));

    g.append("g").call(
      d3.axisLeft(yScale).ticks(5).tickFormat(d3.format(".3f"))
    );

    // Axis labels
    g.append("text")
      .attr("x", innerWidth / 2)
      .attr("y", innerHeight + 35)
      .attr("text-anchor", "middle")
      .text("Longitude");

    g.append("text")
      .attr("x", -innerHeight / 2)
      .attr("y", -50)
      .attr("text-anchor", "middle")
      .attr("transform", "rotate(-90)")
      .text("Latitude");

    // Color scale
    const maxLevel = d3.max(data.treeNodes, (d) => d.level) || 0;
    const colorScale = d3
      .scaleSequential(d3.interpolateViridis)
      .domain([0, Math.max(1, maxLevel)]);

    // Draw tree nodes
    if (showAllNodes && data.treeNodes && data.treeNodes.length > 0) {
      g.selectAll(".node-rect")
        .data(data.treeNodes)
        .enter()
        .append("rect")
        .attr("class", "node-rect")
        .attr("x", (d) => xScale(d.min[0]))
        .attr("y", (d) => yScale(d.max[1]))
        .attr("width", (d) => Math.max(1, xScale(d.max[0]) - xScale(d.min[0])))
        .attr("height", (d) => Math.max(1, yScale(d.min[1]) - yScale(d.max[1])))
        .attr("fill", "none")
        .attr("stroke", (d) => (d.level === 0 ? "purple" : colorScale(d.level)))
        .attr("stroke-width", (d) => (d.level === 0 ? 1 : 2))
        .attr("stroke-dasharray", (d) => (d.level === 0 ? "5,3" : null))
        .attr("opacity", 0.8);

      g.selectAll(".node-label") // This whole block was previously commented out, now conditional
        .data(data.treeNodes)
        .enter()
        .append("text")
        .attr("class", "node-label")
        .attr("x", (d) => xScale((d.min[0] + d.max[0]) / 2))
        .attr("y", (d) => yScale((d.min[1] + d.max[1]) / 2))
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", "#333")
        .attr("stroke", "white")
        .attr("stroke-width", 2)
        .attr("paint-order", "stroke")
        .style("font-size", "10px")
        .text((d) => d.id);
    }

    if (data.dataPoints && data.dataPoints.length > 0) {
      g.selectAll(".data-point")
        .data(data.dataPoints)
        .enter()
        .append("circle")
        .attr("class", "data-point")
        .attr("cx", (d) => xScale((d.min[0] + d.max[0]) / 2))
        .attr("cy", (d) => yScale((d.min[1] + d.max[1]) / 2))
        .attr("r", 3)
        .attr("fill", "blue")
        .attr("opacity", 0.7);
    }

    // Draw target if exists with operation label
    if (data.target && data.target.min && data.target.max) {
      // Set operation label based on operation type
      let operationLabel = "Target";
      if (data.operation === "insert") {
        operationLabel = "INSERTING";
      } else if (data.operation === "search") {
        operationLabel = "SEARCHING";
      }

      // Draw the target rectangle
      try {
        const tx = xScale(data.target.min[0]);
        const ty = yScale(data.target.max[1]);
        const tw = Math.max(
          1,
          xScale(data.target.max[0]) - xScale(data.target.min[0])
        );
        const th = Math.max(
          1,
          yScale(data.target.min[1]) - yScale(data.target.max[1])
        );

        if (isFinite(tx) && isFinite(ty) && isFinite(tw) && isFinite(th)) {
          g.append("rect")
            .attr("class", "target-rect")
            .attr("x", tx)
            .attr("y", ty)
            .attr("width", tw)
            .attr("height", th)
            .attr("fill", "rgba(255, 0, 0, 0.2)")
            .attr("stroke", "red")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "5,5");

          // Add a label for the target
          g.append("text")
            .attr("class", "target-label")
            .attr("x", xScale((data.target.min[0] + data.target.max[0]) / 2))
            .attr("y", yScale(data.target.max[1]) - 10)
            .attr("text-anchor", "middle")
            .attr("fill", "red")
            .attr("font-weight", "bold")
            .attr("stroke", "white")
            .attr("stroke-width", 3)
            .attr("stroke-linejoin", "round")
            .attr("paint-order", "stroke")
            .style("font-size", "12px")
            .text(
              operationLabel +
                (data.operationId !== undefined
                  ? ` (ID: ${data.operationId})`
                  : "")
            );
        }
      } catch (error) {
        console.error("Error drawing target:", error);
      }
    }

    // HOVER HIGHLIGHT - Add after everything so it's on top
    if (hoveredNode && hoveredNode.min && hoveredNode.max) {
      // Check if this is a data point with identical or very close min/max
      const isPoint = hoveredNode.level === -1;

      // For data points or very small boxes, create a visible highlight circle
      if (isPoint) {
        // Calculate center point
        const centerX = xScale((hoveredNode.min[0] + hoveredNode.max[0]) / 2);
        const centerY = yScale((hoveredNode.min[1] + hoveredNode.max[1]) / 2);

        // Draw a circle for point-like data
        g.append("circle")
          .attr("class", "node-highlight")
          .attr("cx", centerX)
          .attr("cy", centerY)
          .attr("r", 8) // Larger than the normal data point circles
          .attr("fill", "none")
          .attr("stroke", isPoint ? "#4CAF50" : "#ff8800")
          .attr("stroke-width", 3)
          .attr("stroke-dasharray", "5,3")
          .attr("pointer-events", "none");

        // Add a pulsing animation highlight
        g.append("circle")
          .attr("class", "node-highlight-pulse")
          .attr("cx", centerX)
          .attr("cy", centerY)
          .attr("r", 3)
          .attr("fill", isPoint ? "#4CAF50" : "#ff8800")
          .attr("opacity", 0.7)
          .attr("pointer-events", "none");
      }
      // For normal rectangles, draw the standard highlight box
      else {
        g.append("rect")
          .attr("class", "node-highlight")
          .attr("x", xScale(hoveredNode.min[0]))
          .attr("y", yScale(hoveredNode.max[1]))
          .attr(
            "width",
            Math.max(1, xScale(hoveredNode.max[0]) - xScale(hoveredNode.min[0]))
          )
          .attr(
            "height",
            Math.max(1, yScale(hoveredNode.min[1]) - yScale(hoveredNode.max[1]))
          )
          .attr("fill", "none")
          .attr("stroke", hoveredNode.type === "data" ? "#4CAF50" : "#ff8800")
          .attr("stroke-width", 4)
          .attr("stroke-dasharray", "8,4")
          .attr("pointer-events", "none");
      }
    }

    // Simple legend
    const legend = svg
      .append("g")
      .attr("transform", `translate(${width - 85}, ${margin.top})`);

    legend
      .append("text")
      .attr("y", -5)
      .attr("font-weight", "bold")
      .text("Legend");

    // Level indicators
    let dataY = 10;
    if (showAllNodes) {
      for (let i = 0; i <= maxLevel; i++) {
        legend
          .append("line")
          .attr("x1", 0)
          .attr("y1", i * 25 + 10)
          .attr("x2", 20)
          .attr("y2", i * 25 + 10)
          .attr("stroke", i === 0 ? "purple" : colorScale(i))
          .attr("stroke-width", i === 0 ? 1 : 2)
          .attr("stroke-dasharray", i === 0 ? "5,3" : null);

        legend
          .append("text")
          .attr("x", 25)
          .attr("y", i * 25 + 14)
          .style("font-size", "12px")
          .text(i === 0 ? "Leaf" : `L${i}`);
      }
      dataY = (maxLevel + 1) * 25 + 10;
    }

    // Data points legend
    // const dataY = (maxLevel + 1) * 25 + 10;
    legend
      .append("circle")
      .attr("cx", 10)
      .attr("cy", dataY)
      .attr("r", 3)
      .attr("fill", "blue")
      .attr("opacity", 0.7);

    legend
      .append("text")
      .attr("x", 25)
      .attr("y", dataY + 4)
      .style("font-size", "12px")
      .text("Data");
  }, [data, hoveredNode, showAllNodes]); // Include hoveredNode in dependency array

  return (
    <div className="w-full h-full border border-gray-200 rounded flex flex-col">
      <div className="flex-grow">
        <svg ref={svgRef} width="100%" height="100%"></svg>
      </div>
    </div>
  );
}

export default SpatialView;
