# Animatronic Maintenance Intelligence

A browser-based demonstrator of how motion, feedback, and condition information could guide maintenance on an animatronic figure.

**Project status: simulated demonstrator.** All telemetry, health scores, trends, events, and suggested tasks use simulated data. They are not reported results from a deployed machine-learning system or measured field improvements. The model descriptions and deployment architecture outline the proposed approach.

## Purpose

A change in motion can originate in the mechanism, encoder, harness, network, or control configuration. This project explores how a technician could follow those competing explanations through related evidence and arrive at a useful next inspection. The emphasis is on making the reason for a maintenance recommendation visible, including the affected actuator and the signals behind it.

## What the interface demonstrates

- **Shared actuator context:** select an actuator and follow its condition, charts, supporting evidence, and suggested tasks across the interface.
- **Moving figure and signal traces:** compare commanded and actual position, current and torque, and following error. Pause or resume the simulated motion.
- **Different failure perspectives:** explore harness flex exposure, pose-related feedback anomalies, encoder health, homing repeatability, and vibration spectra.
- **Guided troubleshooting:** inspect an event chronology, competing hypotheses, and a suggested next maintenance test.
- **Visible reasoning:** open the Methodology / Signal Math and Model Evidence sections to inspect feature definitions, interpretation, and the proposed roles of regression, anomaly detection, and cause classification.

## The reasoning behind the display

The design compares an actuator with expected behavior for a comparable move, pose, direction, speed, temperature, and configuration. Examples include measured-minus-expected effort, feedback events normalized by valid movements, homing variation, and vibration-band energy. Related signals help distinguish possible failure domains.

Health scores summarize where to look; the supporting evidence explains why. The proposed system preserves an **UNKNOWN** outcome when evidence is insufficient and remains advisory, with motion control, drive protection, and safety systems retaining authority.

## A useful route through the project

Start with **Live Figure**, choose an actuator, and compare its motion traces. Follow the same actuator into **Harness / Cable**, **Encoder Health**, or **Vibration**, then review **Maintenance Tasks** and **Troubleshoot**. The **Architecture** section connects this inspection workflow with proposed acquisition, analysis, and post-repair verification.

## GitHub edition

This edition provides the project overview and [HTML source](index.html). GitHub's file view displays the source code.

<details>
<summary>Open the demonstrator locally</summary>

Use GitHub's raw-file download for [index.html](index.html), then open the downloaded file in a modern browser. The simulation and figure illustration are embedded in the file.

</details>

[Return to the portfolio](../README.md)
