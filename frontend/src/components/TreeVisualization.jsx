import React, { useRef, useEffect, useState, use } from "react";
import * as d3 from "d3";

function TreeVisualization({ data, onNodeHover, activeSearchNode, mode }) {
  const svgRef = useRef();
  const [visitedNodes, setVisitedNodes] = useState(new Set());

  useEffect(() => {
    setVisitedNodes(new Set());
  }, [mode]);

  // Effect to track visited nodes
  useEffect(() => {
    if (activeSearchNode) {
      setVisitedNodes((prev) => {
        const newSet = new Set(prev);
        newSet.add(activeSearchNode.id);
        // Add a composite key that includes both ID and node type
        newSet.add(
          activeSearchNode.isDataPoint
            ? "d_" + activeSearchNode.id
            : "t_" + activeSearchNode.id
        );
        return newSet;
      });
    }
  }, [activeSearchNode]);

  useEffect(() => {
    if (!data || !data.treeNodes || data.treeNodes.length === 0) {
      console.log("No tree nodes data available");
      return;
    }

    try {
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      const container = svg.node().parentElement;
      if (!container) {
        console.log("Container element not found");
        return;
      }

      let tooltip = d3.select("body").select(".tree-tooltip");
      if (tooltip.empty()) {
        tooltip = d3
          .select("body")
          .append("div")
          .attr("class", "tree-tooltip")
          .style("position", "absolute")
          .style("visibility", "hidden")
          .style("background-color", "white")
          .style("border", "1px solid #ddd")
          .style("border-radius", "4px")
          .style("padding", "8px")
          .style("font-size", "12px")
          .style("box-shadow", "0 2px 5px rgba(0,0,0,0.2)")
          .style("z-index", "1000")
          .style("pointer-events", "none");
      }

      // Set fixed dimensions if container dimensions are zero
      const width = container.clientWidth || 600;
      const height = container.clientHeight || 400;

      // STEP 1: Create a map of all nodes first
      const nodesById = {};

      data.treeNodes.forEach((node) => {
        nodesById[`t_${node.id}`] = {
          ...node,
          children: [], // Will be populated with actual node references
          nodeType: "tree",
          isDataPoint: false,
        };
      });

      data.dataPoints.forEach((point) => {
        nodesById[`d_${point.id}`] = {
          ...point,
          children: [],
          nodeType: "data",
          isDataPoint: true,
        };
      });

      // STEP 2: Build the tree structure with correct parent-child relationships
      data.treeNodes.forEach((node) => {
        const treeNodeKey = `t_${node.id}`;

        if (
          node.childIds &&
          Array.isArray(node.childIds) &&
          node.childIds.length > 0
        ) {
          node.childIds.forEach((childId) => {
            const childKey = `t_${childId}`;
            if (nodesById[childKey]) {
              nodesById[treeNodeKey].children.push(nodesById[childKey]);
            } else {
              console.log(`Child ID ${childId} not found for node ${node.id}`);
            }
          });
        }

        // Connect data point children for leaf nodes
        if (
          node.dataPointIds &&
          Array.isArray(node.dataPointIds) &&
          node.dataPointIds.length > 0
        ) {
          node.dataPointIds.forEach((dataId) => {
            const dataPointKey = `d_${dataId}`;
            if (nodesById[dataPointKey]) {
              nodesById[treeNodeKey].children.push(nodesById[dataPointKey]);
            } else {
              console.log(
                `Data point ID ${dataId} not found for node ${node.id}`
              );
            }
          });
        }
      });

      // STEP 3: Find the root node (highest level node)
      let rootNode = nodesById["t_0"];

      // STEP 4: Create D3 hierarchy from our custom tree structure

      const root = d3.hierarchy(rootNode, (d) => {
        if (d.children && d.children.length > 0) {
          return d.children;
        }
        return null;
      });

      // Create tree layout with fixed size
      const treeLayout = d3.tree().size([width - 100, height - 80]);
      const treeData = treeLayout(root);

      // Create visualization group
      const g = svg
        .append("g")
        .attr("transform", `translate(50, 40)`)
        .attr("class", "tree-container");

      // Draw links between nodes
      g.selectAll(".link")
        .data(treeData.links())
        .enter()
        .append("path")
        .attr("class", "link")
        .attr(
          "d",
          d3
            .linkVertical()
            .x((d) => d.x)
            .y((d) => d.y)
        )
        .attr("fill", "none")
        .attr("stroke", (d) => {
          // Style links to data points differently
          return d.target.data.isDataPoint ? "#4CAF50" : "#ccc";
        })
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", (d) => {
          // Dashed lines for connections to data points
          return d.target.data.isDataPoint ? "3,3" : null;
        });

      // Create a color scale for node levels
      const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

      // Draw nodes
      const nodes = g
        .selectAll(".node")
        .data(treeData.descendants())
        .enter()
        .append("g")
        .attr(
          "class",
          (d) => `node ${d.data.isDataPoint ? "data-node" : "tree-node"}`
        )
        .attr("transform", (d) => `translate(${d.x},${d.y})`)
        .on("mouseenter", function (event, d) {
          // Highlight the current node
          d3.select(this)
            .select("rect")
            .attr("stroke", "#ff8800")
            .attr("stroke-width", 3);

          // Show tooltip for data points
          if (d.data.isDataPoint) {
            const cafeData = d.data;
            let tooltipContent = `
              <div style="font-weight:bold; border-bottom:1px solid #ddd; padding-bottom:4px; margin-bottom:4px">
                Cafe ID: ${cafeData.cafeId || cafeData.id}
              </div>
              <div><strong>Location:</strong> ${cafeData.lon?.toFixed(
                5
              )}, ${cafeData.lat?.toFixed(5)}</div>
            `;

            if (cafeData.rating !== undefined) {
              tooltipContent += `<div><strong>Rating:</strong> ${cafeData.rating.toFixed(
                1
              )}/5.0</div>`;
            }

            if (cafeData.current_crowd !== undefined) {
              tooltipContent += `<div><strong>Current crowd:</strong> ${cafeData.current_crowd} people</div>`;
            }

            if (cafeData.name) {
              tooltipContent =
                `
                <div style="font-weight:bold; border-bottom:1px solid #ddd; padding-bottom:4px; margin-bottom:4px">
                  ${cafeData.name} (ID: ${cafeData.cafeId || cafeData.id})
                </div>` +
                tooltipContent.split("</div>").slice(1).join("</div>");
            }

            const nodePosition = this.getBoundingClientRect();

            tooltip
              .html(tooltipContent)
              .style("visibility", "visible")
              .style("left", nodePosition.left - 150 + "px") // Position to the left of node
              .style("top", nodePosition.top - 110 + "px"); // Position above the node
          } else {
            const cafeData = d.data;
            let tooltipContent = `
              <div style="font-weight:bold; border-bottom:1px solid #ddd; padding-bottom:4px; margin-bottom:4px">
                Cafe ID: ${cafeData.id}
              </div>
              <div><strong>Location (bottom-left):</strong> ${cafeData.min[0]?.toFixed(
                5
              )}, ${cafeData.min[1]?.toFixed(5)}</div>
            `;

            if (cafeData.current_crowd !== undefined) {
              tooltipContent += `<div><strong>Current crowd:</strong> ${cafeData.current_crowd} people</div>`;
            }

            if (cafeData.id) {
              tooltipContent =
                `
                <div style="font-weight:bold; border-bottom:1px solid #ddd; padding-bottom:4px; margin-bottom:4px">
                  Node ID: ${cafeData.id}
                </div>` +
                tooltipContent.split("</div>").slice(1).join("</div>");
            }

            const nodePosition = this.getBoundingClientRect();

            tooltip
              .html(tooltipContent)
              .style("visibility", "visible")
              .style("left", nodePosition.left - 150 + "px") // Position to the left of node
              .style("top", nodePosition.top - 110 + "px"); // Position above the node
          }

          // Call the hover callback with node data for the spatial view
          if (onNodeHover && d.data) {
            onNodeHover({
              id: d.data.originalId || d.data.id,
              type: d.data.isDataPoint ? "data" : "tree",
              min: d.data.min,
              max: d.data.max,
              level: d.data.level,
            });
          }
        })
        .on("mouseleave", function () {
          // Reset highlight on mouse leave
          d3.select(this)
            .select("rect")
            .attr("stroke", "#555")
            .attr("stroke-width", 1);

          // Hide tooltip
          tooltip.style("visibility", "hidden");

          // Clear the highlight in spatial view
          if (onNodeHover) {
            onNodeHover(null);
          }
        });
      // Add node rectangles
      nodes
        .append("rect")
        .attr("x", (d) => (d.data.isDataPoint ? -30 : -40))
        .attr("y", (d) => (d.data.isDataPoint ? -15 : -20))
        .attr("width", (d) => (d.data.isDataPoint ? 60 : 80))
        .attr("height", (d) => (d.data.isDataPoint ? 30 : 40))
        .attr("rx", 3)
        .attr("ry", 3)
        .attr("fill", (d) => {
          if (d.data.isDataPoint) {
            return "#4CAF50"; // Green for data points
          }
          return colorScale(d.data.level || 0);
        })
        .attr("stroke", "#555")
        .attr("stroke-width", 1);

      nodes
        .append("rect")
        .attr("x", (d) => (d.data.isDataPoint ? -30 : -40))
        .attr("y", (d) => (d.data.isDataPoint ? -15 : -20))
        .attr("width", (d) => (d.data.isDataPoint ? 60 : 80))
        .attr("height", (d) => (d.data.isDataPoint ? 30 : 40))
        .attr("rx", 3)
        .attr("ry", 3)
        .attr("fill", (d) => {
          if (d.data.isDataPoint) {
            return "#4CAF50"; // Green for data points
          }
          return colorScale(d.data.level || 0);
        })
        .attr("stroke", (d) => {
          // Current active search node - compare both id and isDataPoint
          if (
            mode === "search" &&
            activeSearchNode &&
            d.data.id === activeSearchNode.id &&
            d.data.isDataPoint === (activeSearchNode.isDataPoint === true)
          ) {
            return "#FF0000"; // Bright red for active node
          }
          // Previously visited nodes in search path - compare both id and isDataPoint
          else if (
            mode === "search" &&
            visitedNodes.has(d.data.id) &&
            visitedNodes.has(
              d.data.isDataPoint ? "d_" + d.data.id : "t_" + d.data.id
            )
          ) {
            return "#FF9800"; // Orange for previously visited nodes
          }
        })
        .attr("stroke-width", (d) => {
          // Make active and visited nodes have thicker borders
          if (
            (activeSearchNode &&
              d.data.id === activeSearchNode.id &&
              d.data.isDataPoint === (activeSearchNode.isDataPoint === true)) ||
            (visitedNodes.has(d.data.id) &&
              visitedNodes.has(
                d.data.isDataPoint ? "d_" + d.data.id : "t_" + d.data.id
              ))
          ) {
            return 3;
          }
          return 1;
        })
        .attr("stroke-dasharray", (d) => {
          // Optional: Make active search node have solid border and visited nodes have dashed borders
          if (
            activeSearchNode &&
            d.data.id === activeSearchNode.id &&
            d.data.isDataPoint === (activeSearchNode.isDataPoint === true)
          ) {
            return null; // Solid line for active node
          } else if (
            visitedNodes.has(d.data.id) &&
            visitedNodes.has(
              d.data.isDataPoint ? "d_" + d.data.id : "t_" + d.data.id
            )
          ) {
            return "5,3"; // Dashed line for visited nodes
          }
          return null; // Regular solid line for other nodes
        });
      // Add node ID labels using the original ID
      nodes
        .append("text")
        .attr("dy", "0.3em")
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .style("font-size", (d) => (d.data.isDataPoint ? "10px" : "11px"))
        .text((d) => `ID:${d.data.id}`);
      // Add level labels for tree nodes only
      nodes
        .filter((d) => !d.data.isDataPoint)
        .append("text")
        .attr("dy", "1.5em")
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .style("font-size", "9px")
        .text((d) => (d.data.level === 0 ? "Leaf" : `L:${d.data.level}`));

      // Add "DATA" label to data points
      nodes
        .filter((d) => d.data.isDataPoint)
        .append("text")
        .attr("dy", "1.5em")
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .style("font-size", "8px")
        .text("DATA");

      // Add minimal legend
      const legend = svg
        .append("g")
        .attr("transform", `translate(${width - 100}, 20)`);

      // Add level indicators to legend
      const maxNodeLevel = Math.max(...data.treeNodes.map((n) => n.level));
      for (let i = 0; i <= maxNodeLevel; i++) {
        legend
          .append("rect")
          .attr("x", 0)
          .attr("y", i * 25)
          .attr("width", 20)
          .attr("height", 20)
          .attr("fill", colorScale(i));

        legend
          .append("text")
          .attr("x", 25)
          .attr("y", i * 25 + 14)
          .style("font-size", "12px")
          .text(i === 0 ? "Leaf Nodes" : `L${i}`);
      }

      // Add data points to legend if they exist
      if (data.dataPoints && data.dataPoints.length > 0) {
        const dataPointY = (maxNodeLevel + 1) * 25;
        legend
          .append("rect")
          .attr("x", 0)
          .attr("y", dataPointY)
          .attr("width", 20)
          .attr("height", 20)
          .attr("fill", "#4CAF50");

        legend
          .append("text")
          .attr("x", 25)
          .attr("y", dataPointY + 14)
          .style("font-size", "12px")
          .text("Data Points");
      }
    } catch (error) {
      console.error("Error rendering tree visualization:", error);
    }
  }, [data, activeSearchNode]);

  return (
    <div className="w-full h-full min-h-[400px] border border-gray-200 rounded">
      <svg ref={svgRef} width="100%" height="100%" className="mx-auto"></svg>
    </div>
  );
}

export default TreeVisualization;
