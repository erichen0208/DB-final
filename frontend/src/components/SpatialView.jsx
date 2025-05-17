import React, { useRef, useEffect } from "react";
import * as d3 from "d3";

function SpatialView({ data }) {
  const svgRef = useRef();

  useEffect(() => {
    if (!data || !data.treeNodes || data.treeNodes.length === 0) return;

    let svg;

    try {
      svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      const container = svgRef.current.parentElement;
      if (!container) return;

      const width = container.clientWidth || 600;
      const height = container.clientHeight || 400;

      const margin = { top: 30, right: 90, bottom: 40, left: 50 };
      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;

      // Calculate bounds based on data
      let xMin = 0,
        xMax = 100,
        yMin = 0,
        yMax = 100;

      // If target exists, make sure it's included in the bounds
      if (data.target) {
        xMin = Math.min(xMin, data.target.min[0] - 5);
        xMax = Math.max(xMax, data.target.max[0] + 5);
        yMin = Math.min(yMin, data.target.min[1] - 5);
        yMax = Math.max(yMax, data.target.max[1] + 5);
      }

      // Create scales with padding
      const xScale = d3
        .scaleLinear()
        .domain([xMin, xMax])
        .range([0, innerWidth]);
      const yScale = d3
        .scaleLinear()
        .domain([yMin, yMax])
        .range([innerHeight, 0]);

      // Create main group
      const g = svg
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

      // Create axes
      const xAxis = d3.axisBottom(xScale);
      const yAxis = d3.axisLeft(yScale);

      g.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);

      g.append("g").attr("class", "y-axis").call(yAxis);

      // Axis labels
      g.append("text")
        .attr("class", "x-axis-label")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight + 35)
        .attr("text-anchor", "middle")
        .attr("fill", "#666")
        .text("X Dimension");

      g.append("text")
        .attr("class", "y-axis-label")
        .attr("x", -innerHeight / 2)
        .attr("y", -35)
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("fill", "#666")
        .text("Y Dimension");

      // Create a color scale for node levels
      const maxLevel = d3.max(data.treeNodes, (d) => d.level) || 0;
      const colorScale = d3
        .scaleSequential(d3.interpolateViridis)
        .domain([0, Math.max(1, maxLevel)]);

      // Draw tree nodes (all levels)
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
        .attr("stroke", (d) => (d.level === 0 ? "purple" : colorScale(d.level))) // Purple for leaf nodes
        .attr("stroke-width", (d) => (d.level === 0 ? 1 : 2))
        .attr("stroke-dasharray", (d) => (d.level === 0 ? "5,3" : null))
        .attr("opacity", (d) => (d.level === 0 ? 0.7 : 0.8));

      // Handle target rectangle
      let operationLabel = "";

      // Process target info if available in data
      if (data.target) {
        const targetRect = data.target;
        // console.log("Using target from JSON:", targetRect);

        // Set operation label based on operation type
        if (data.operation === "insert" || data.operation === "insert_end") {
          operationLabel = "INSERTING";
        } else if (data.operation && data.operation.includes("search")) {
          operationLabel = "SEARCHING";
        } else if (data.operation && data.operation.includes("remove")) {
          operationLabel = "REMOVING";
        } else if (data.operation && data.operation.includes("range_query")) {
          operationLabel = "RANGE QUERY";
        }

        // Use consistent red styling for all target rectangles
        const fillColor = "rgba(255, 0, 0, 0.2)";
        const strokeColor = "red";

        // Draw the target rectangle
        g.append("rect")
          .attr("class", "target-rect")
          .attr("x", xScale(targetRect.min[0]))
          .attr("y", yScale(targetRect.max[1]))
          .attr(
            "width",
            Math.max(1, xScale(targetRect.max[0]) - xScale(targetRect.min[0]))
          )
          .attr(
            "height",
            Math.max(1, yScale(targetRect.min[1]) - yScale(targetRect.max[1]))
          )
          .attr("fill", fillColor)
          .attr("stroke", strokeColor)
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "5,5");

        // Add a label for the target
        g.append("text")
          .attr("class", "target-label")
          .attr("x", xScale((targetRect.min[0] + targetRect.max[0]) / 2))
          .attr("y", yScale(targetRect.max[1]) - 10)
          .attr("text-anchor", "middle")
          .attr("fill", strokeColor)
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

      // Draw all data points with simple styling
      if (data.dataPoints && data.dataPoints.length > 0) {
        g.selectAll(".data-rect")
          .data(data.dataPoints)
          .enter()
          .append("rect")
          .attr("class", "data-rect")
          .attr("x", (d) => xScale(d.min[0]))
          .attr("y", (d) => yScale(d.max[1]))
          .attr("width", (d) =>
            Math.max(1, xScale(d.max[0]) - xScale(d.min[0]))
          )
          .attr("height", (d) =>
            Math.max(1, yScale(d.min[1]) - yScale(d.max[1]))
          )
          .attr("fill", "none")
          .attr("stroke", "#ccc")
          .attr("stroke-width", 1)
          .attr("stroke-dasharray", "2,2")
          .attr("opacity", 0.6);
      }

      // Add node labels for tree nodes
      g.selectAll(".node-label")
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
        .attr("stroke-width", 3)
        .attr("stroke-linejoin", "round")
        .attr("paint-order", "stroke")
        .style("font-size", (d) => (d.level === 0 ? "9px" : "10px"));

      // Add a legend
      const legend = svg
        .append("g")
        .attr(
          "transform",
          `translate(${width - margin.right - 5}, ${margin.top})`
        );

      legend
        .append("text")
        .attr("x", 0)
        .attr("y", -10)
        .attr("font-weight", "bold")
        .attr("fill", "#333")
        .text("Legend");

      // Add rectangles for each level (show purple for leaf nodes)
      for (let i = 0; i <= maxLevel; i++) {
        legend
          .append("line")
          .attr("x1", 0)
          .attr("y1", i * 25 + 10)
          .attr("x2", 20)
          .attr("y2", i * 25 + 10)
          .attr("stroke", i === 0 ? "purple" : colorScale(i)) // Purple for leaf nodes
          .attr("stroke-width", i === 0 ? 1 : 2)
          .attr("stroke-dasharray", i === 0 ? "5,3" : null);

        legend
          .append("text")
          .attr("x", 25)
          .attr("y", i * 25 + 14)
          .style("font-size", "12px")
          .attr("fill", "#333")
          .text(i === 0 ? "Leaf Nodes" : `Level ${i}`);
      }

      // Always add data points to legend
      const dataPointLegendY = (maxLevel + 1) * 25 + 10;
      legend
        .append("rect")
        .attr("x", 0)
        .attr("y", dataPointLegendY)
        .attr("width", 20)
        .attr("height", 20)
        .attr("fill", "none")
        .attr("stroke", "#ccc")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "2,2");

      legend
        .append("text")
        .attr("x", 25)
        .attr("y", dataPointLegendY + 14)
        .style("font-size", "12px")
        .attr("fill", "#333")
        .text("Data Points");

      // Add target/operation item to legend
      if (data.target) {
        const targetLegendY = (maxLevel + 2) * 25 + 10;
        let operationText = "";

        if (data.operation === "insert") {
          operationText = "Insert";
        } else if (data.operation && data.operation.includes("search")) {
          operationText = "Search";
        } else if (data.operation && data.operation.includes("remove")) {
          operationText = "Remove";
        } else if (data.operation && data.operation.includes("range_query")) {
          operationText = "Range";
        }

        legend
          .append("rect")
          .attr("x", 0)
          .attr("y", targetLegendY)
          .attr("width", 20)
          .attr("height", 20)
          .attr("fill", "rgba(255, 0, 0, 0.2)")
          .attr("stroke", "red")
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "5,5");

        legend
          .append("text")
          .attr("x", 25)
          .attr("y", targetLegendY + 14)
          .style("font-size", "12px")
          .attr("fill", "#333")
          .text(operationText);
      }

      // If search path is available, show a special entry in the legend
      if (data.searchPath && data.searchPath.length > 0) {
        const pathLegendY = (maxLevel + (data.target ? 3 : 2)) * 25 + 10;

        legend
          .append("line")
          .attr("x1", 0)
          .attr("y1", pathLegendY + 10)
          .attr("x2", 20)
          .attr("y2", pathLegendY + 10)
          .attr("stroke", "orange")
          .attr("stroke-width", 3);

        legend
          .append("text")
          .attr("x", 25)
          .attr("y", pathLegendY + 14)
          .style("font-size", "12px")
          .attr("fill", "#333")
          .text(`Search Path (${data.searchPath.length} nodes)`);
      }

      // Debug information
      if (data.operation) {
        svg
          .append("text")
          .attr("x", 10)
          .attr("y", height - 10)
          .style("font-size", "10px")
          .attr("fill", "#999")
          .text(
            `Operation: ${data.operation} | Tree size: ${
              data.treeSize || "N/A"
            }`
          );
      }
    } catch (error) {
      console.error("Error rendering SpatialView:", error);
    }

    // Clean up
    return () => {
      if (svg) {
        svg.selectAll("*").interrupt(); // Stop any ongoing transitions
      }
    };
  }, [data]);

  return (
    <div className="w-full h-full border border-gray-200 rounded">
      <svg ref={svgRef} width="100%" height="100%" className="mx-auto"></svg>
    </div>
  );
}

export default SpatialView;
