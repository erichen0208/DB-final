// src/components/TreeVisualization.jsx
import React, { useRef, useEffect } from "react";
import * as d3 from "d3";

function TreeVisualization({ data }) {
  const svgRef = useRef();

  useEffect(() => {
    if (!data || !data.treeNodes || data.treeNodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const container = svg.node().parentElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Process the tree structure to handle both internal nodes and data points
    const nodesById = {};

    // First pass: create node objects for tree nodes
    data.treeNodes.forEach((node) => {
      nodesById[node.id] = {
        ...node,
        children: [],
      };
    });

    // Also add data points to the nodes dictionary
    if (data.dataPoints) {
      data.dataPoints.forEach((dataPoint) => {
        nodesById[dataPoint.id] = {
          ...dataPoint,
          level: -1, // Ensure data points are marked as level -1
          isLeaf: true,
          children: [],
        };
      });
    }

    // Second pass: build child relationships from tree nodes
    data.treeNodes.forEach((node) => {
      // Handle regular parent-child relationships between tree nodes
      if (node.children && node.children.length > 0) {
        node.children.forEach((childId) => {
          if (nodesById[childId]) {
            nodesById[node.id].children.push(nodesById[childId]);
          }
        });
      }

      // Handle data point relationships (leaf nodes to their data points)
      if (node.dataPointIds && node.dataPointIds.length > 0) {
        node.dataPointIds.forEach((dataId) => {
          if (nodesById[dataId]) {
            nodesById[node.id].children.push(nodesById[dataId]);
          }
        });
      }
    });

    // Find the root node (the one with highest level)
    let rootNode = null;
    let maxLevel = -1;

    data.treeNodes.forEach((node) => {
      if (node.level > maxLevel) {
        maxLevel = node.level;
        rootNode = node;
      }
    });

    if (!rootNode) return;

    // Create the hierarchical data structure
    const root = d3.hierarchy(nodesById[rootNode.id], (d) => d.children);

    // Create a tree layout with proper orientation
    const treeLayout = d3.tree().size([width - 100, height - 100]);

    const treeData = treeLayout(root);

    // Create main group for the visualization with a small margin
    const g = svg.append("g").attr("transform", `translate(50, 30)`);

    // Add links between nodes
    g.selectAll("path")
      .data(treeData.links())
      .enter()
      .append("path")
      .attr(
        "d",
        d3
          .linkVertical()
          .x((d) => d.x)
          .y((d) => d.y)
      )
      .attr("fill", "none")
      .attr("stroke", (d) => {
        // Highlight search paths
        if (data.operation && data.operation.includes("search")) {
          if (isNodeInSearchPath(d.source.data.id, d.target.data.id, data)) {
            return "red";
          }
        }
        // Differentiate links to data points
        if (d.target.data.level === -1) {
          return "#4CAF50"; // Green for data point links
        }
        return "#ccc";
      })
      .attr("stroke-width", (d) => {
        if (data.operation && data.operation.includes("search")) {
          if (isNodeInSearchPath(d.source.data.id, d.target.data.id, data)) {
            return 2.5;
          }
        }
        return d.target.data.level === -1 ? 1 : 1.5;
      })
      .attr("stroke-dasharray", (d) => {
        return d.target.data.level === -1 ? "3,3" : null; // Dashed line for data point links
      });

    // Create a color scale for node levels
    const colorScale = d3
      .scaleSequential(d3.interpolateViridis)
      .domain([0, maxLevel]);

    // Add nodes as boxes
    const nodes = g
      .selectAll(".node")
      .data(treeData.descendants())
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", (d) => `translate(${d.x},${d.y})`);

    // Add node rectangles
    nodes
      .append("rect")
      .attr("x", (d) => (d.data.level === -1 ? -30 : -40)) // Smaller rectangles for data points
      .attr("y", (d) => (d.data.level === -1 ? -15 : -20))
      .attr("width", (d) => (d.data.level === -1 ? 60 : 80))
      .attr("height", (d) => (d.data.level === -1 ? 30 : 40))
      .attr("rx", 3)
      .attr("ry", 3)
      .attr("fill", (d) => {
        if (
          data.operation &&
          data.operation.includes("search_end") &&
          d.data.id === data.operationId
        ) {
          return "orangered";
        }
        if (d.data.level === -1) {
          return "#4CAF50"; // Green for data points
        }
        return colorScale(d.data.level);
      })
      .attr("stroke", (d) => {
        if (
          data.operation &&
          data.operation.includes("search") &&
          isNodeInSearchPath(d.data.id, null, data)
        ) {
          return "red";
        }
        return "#555";
      })
      .attr("stroke-width", (d) => {
        if (
          data.operation &&
          data.operation.includes("search") &&
          isNodeInSearchPath(d.data.id, null, data)
        ) {
          return 2.5;
        }
        return 1;
      });

    // Add node labels
    nodes
      .append("text")
      .attr("dy", "0.3em")
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .style("font-size", (d) => (d.data.level === -1 ? "10px" : "11px"))
      .style("font-weight", (d) => {
        if (
          data.operation &&
          data.operation.includes("search") &&
          isNodeInSearchPath(d.data.id, null, data)
        ) {
          return "bold";
        }
        return "normal";
      })
      .text((d) => `ID:${d.data.id}`);

    // Add level labels for all nodes except data points
    nodes
      .filter((d) => d.data.level !== -1)
      .append("text")
      .attr("dy", "1.5em")
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .style("font-size", "9px")
      .text((d) => (d.data.level === 0 ? "Leaf" : `L:${d.data.level}`));

    // Add "DATA" label to the data points
    nodes
      .filter((d) => d.data.level === -1)
      .append("text")
      .attr("dy", "1.5em")
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .style("font-size", "8px")
      .style("font-weight", "bold")
      .text("DATA");

    // Add "FOUND" label to the target node if it's the final search result
    nodes
      .filter(
        (d) =>
          data.operation &&
          data.operation.includes("search_end") &&
          d.data.id === data.operationId
      )
      .append("text")
      .attr("dy", "2.8em")
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .style("font-size", "9px")
      .style("font-weight", "bold")
      .text("FOUND");

    // Add a legend
    const legend = svg
      .append("g")
      .attr("transform", `translate(${width - 100}, 20)`);

    // Add rectangles for each level
    for (let i = maxLevel; i >= 0; i--) {
      legend
        .append("rect")
        .attr("x", 0)
        .attr("y", (maxLevel - i) * 25)
        .attr("width", 20)
        .attr("height", 20)
        .attr("fill", colorScale(i));

      legend
        .append("text")
        .attr("x", 25)
        .attr("y", (maxLevel - i) * 25 + 14)
        .style("font-size", "12px")
        .attr("fill", "#333")
        .text(i === 0 ? "Leaf Nodes" : `Level ${i}`);
    }

    // Add data point to legend
    legend
      .append("rect")
      .attr("x", 0)
      .attr("y", (maxLevel + 1) * 25)
      .attr("width", 20)
      .attr("height", 20)
      .attr("fill", "#4CAF50");

    legend
      .append("text")
      .attr("x", 25)
      .attr("y", (maxLevel + 1) * 25 + 14)
      .style("font-size", "12px")
      .attr("fill", "#333")
      .text("Data Points");

    // Add search path to legend if relevant
    if (data.operation && data.operation.includes("search")) {
      const searchLegendY = (maxLevel + 2) * 25;

      legend
        .append("rect")
        .attr("x", 0)
        .attr("y", searchLegendY)
        .attr("width", 20)
        .attr("height", 20)
        .attr("fill", "red")
        .attr("opacity", 0.6);

      legend
        .append("text")
        .attr("x", 25)
        .attr("y", searchLegendY + 14)
        .style("font-size", "12px")
        .attr("fill", "#333")
        .text("Search Path");

      if (data.operation && data.operation.includes("search_end")) {
        legend
          .append("rect")
          .attr("x", 0)
          .attr("y", searchLegendY + 25)
          .attr("width", 20)
          .attr("height", 20)
          .attr("fill", "orangered")
          .attr("opacity", 0.8);

        legend
          .append("text")
          .attr("x", 25)
          .attr("y", searchLegendY + 25 + 14)
          .style("font-size", "12px")
          .attr("fill", "#333")
          .text("Target Node");
      }
    }
  }, [data]);

  // Helper function to check if a node is in the search path
  function isNodeInSearchPath(nodeId, childId, data) {
    if (!data.operation || !data.operation.includes("search")) {
      return false;
    }

    const targetId = data.operationId;

    // Direct match
    if (nodeId === targetId || childId === targetId) {
      return true;
    }

    // Find the node - could be either a tree node or data point
    const isDataPoint = nodeId >= 1000; // Simple heuristic based on ID range
    const allNodes = [...data.treeNodes];

    // Find the node in the appropriate collection
    const node = allNodes.find((n) => n.id === nodeId);
    if (!node) return false;

    // Check if target is among direct children
    if (node.children && node.children.includes(targetId)) return true;

    // Check if target is among data point children
    if (node.dataPointIds && node.dataPointIds.includes(targetId)) return true;

    // Check if any child leads to target
    if (!node.children) return false;

    return node.children.some((childId) => {
      // Find if this child is in tree nodes
      const childIsInTree = data.treeNodes.some((n) => n.id === childId);

      // For tree nodes
      if (childIsInTree) {
        const childNode = data.treeNodes.find((n) => n.id === childId);
        if (!childNode) return false;
        if (childNode.id === targetId) return true;
      }

      // For data points
      if (!childIsInTree && data.dataPoints) {
        const dataPoint = data.dataPoints.find((d) => d.id === childId);
        if (!dataPoint) return false;
        if (dataPoint.id === targetId) return true;
      }

      return false;
    });
  }

  return (
    <div className="w-full h-full border border-gray-200 rounded">
      <svg ref={svgRef} width="100%" height="100%" className="mx-auto"></svg>
    </div>
  );
}

export default TreeVisualization;
