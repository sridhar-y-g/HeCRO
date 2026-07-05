document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const auditForm = document.getElementById('audit-form');
  const storeUrlInput = document.getElementById('store-url');
  const competitorUrlInput = document.getElementById('competitor-url');
  const manualFallbackWell = document.getElementById('manual-fallback-well');
  const manualTextInput = document.getElementById('manual-text');
  const submitBtn = document.getElementById('submit-btn');
  const toggleManualBtn = document.getElementById('toggle-manual-btn');
  
  const inputSection = document.getElementById('input-section');
  const loadingSection = document.getElementById('loading-section');
  const resultsSection = document.getElementById('results-section');
  const historySection = document.getElementById('history-section');
  
  // Progress Steps
  const stepGather = document.getElementById('step-gather');
  const stepAi = document.getElementById('step-ai');
  const stepRoute = document.getElementById('step-route');
  
  // Results Elements
  const gradeValue = document.getElementById('grade-value');
  const resultBrandName = document.getElementById('result-brand-name');
  const resultBrandUrl = document.getElementById('result-brand-url');
  const resultSummary = document.getElementById('result-summary');
  const croTableBody = document.getElementById('cro-table-body');
  const opportunitiesCardsContainer = document.getElementById('opportunities-cards-container');
  
  // History Container
  const historyListContainer = document.getElementById('history-list-container');
  
  // Modal Elements
  const briefModal = document.getElementById('brief-modal');
  const modalBriefTitle = document.getElementById('modal-brief-title');
  const modalHypothesis = document.getElementById('modal-hypothesis');
  const modalControl = document.getElementById('modal-control');
  const modalVariant = document.getElementById('modal-variant');
  const modalMetric = document.getElementById('modal-metric');
  const modalDevTime = document.getElementById('modal-dev-time');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const closeModalFooterBtn = document.getElementById('close-modal-footer-btn');
  const copyBriefBtn = document.getElementById('copy-brief-btn');

  // State
  let activeAuditData = null;
  let isManualVisible = false;

  // Toggle manual text field fallback
  toggleManualBtn.addEventListener('click', () => {
    isManualVisible = !isManualVisible;
    if (isManualVisible) {
      manualFallbackWell.classList.remove('hidden');
      toggleManualBtn.querySelector('span').textContent = 'Hide Manual Input';
      storeUrlInput.removeAttribute('required');
    } else {
      manualFallbackWell.classList.add('hidden');
      toggleManualBtn.querySelector('span').textContent = 'Paste Text Manually';
      storeUrlInput.setAttribute('required', 'required');
    }
  });

  // Fetch and render history
  async function loadHistory() {
    try {
      const res = await fetch('/api/history');
      if (res.ok) {
        const history = await res.json();
        renderHistoryList(history);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  }

  function renderHistoryList(history) {
    if (!history || history.length === 0) {
      historyListContainer.innerHTML = `<div class="empty-history">No past activities logged. Run your first audit to populate the database!</div>`;
      return;
    }

    historyListContainer.innerHTML = history.map(item => {
      const date = new Date(item.timestamp).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      return `
        <div class="history-item-well" data-id="${item.id}">
          <div class="history-item-left">
            <div class="history-grade-well">
              <span>${item.grade}</span>
            </div>
            <div class="history-item-details">
              <span class="history-brand">${item.brandName}</span>
              <span class="history-urls">${item.url} ${item.competitorUrl ? ' vs ' + item.competitorUrl : ''}</span>
            </div>
          </div>
          <span class="history-time">${date}</span>
        </div>
      `;
    }).join('');

    // Attach click events
    document.querySelectorAll('.history-item-well').forEach(el => {
      el.addEventListener('click', () => {
        const auditId = el.getAttribute('data-id');
        const selected = history.find(item => item.id === auditId);
        if (selected) {
          renderReport(selected.report, selected.url);
          // Scroll to results smooth
          resultsSection.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  }

  // Submit Audit Form
  auditForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = storeUrlInput.value.trim();
    const competitorUrl = competitorUrlInput.value.trim();
    const manualText = manualTextInput.value.trim();

    // Reset progress steps styling
    resetProgressSteps();
    
    // Hide results, show loading
    resultsSection.classList.add('hidden');
    inputSection.classList.add('hidden');
    historySection.classList.add('hidden');
    loadingSection.classList.remove('hidden');

    // Simulate progress log changes with timing + actual calls
    updateStepState(stepGather, 'active');
    
    try {
      const fetchPromise = fetch('/api/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url, competitorUrl, manualText })
      });

      // Simple timing logs simulation for nice visual pacing during the API request
      const timingInterval1 = setTimeout(() => {
        updateStepState(stepGather, 'done');
        updateStepState(stepAi, 'active');
      }, 3500);

      const timingInterval2 = setTimeout(() => {
        updateStepState(stepAi, 'done');
        updateStepState(stepRoute, 'active');
      }, 8500);

      const res = await fetchPromise;
      
      clearTimeout(timingInterval1);
      clearTimeout(timingInterval2);

      if (res.status === 422) {
        // Scrape Blocked! Show elegant backup input screen
        const errJson = await res.json();
        showScrapeBlockedError(errJson.message);
        return;
      }

      if (!res.ok) {
        throw new Error('Audit API request failed');
      }

      const auditResult = await res.json();
      
      // Finalize progress visual fast
      updateStepState(stepGather, 'done');
      updateStepState(stepAi, 'done');
      updateStepState(stepRoute, 'done');

      setTimeout(() => {
        loadingSection.classList.add('hidden');
        inputSection.classList.remove('hidden');
        historySection.classList.remove('hidden');
        resultsSection.classList.remove('hidden');
        
        renderReport(auditResult.report, url || 'Manual Input');
        loadHistory(); // reload history lists
      }, 1000);

    } catch (err) {
      console.error(err);
      alert('An error occurred during store analysis. Please make sure the URL is valid or try pasting page text directly.');
      loadingSection.classList.add('hidden');
      inputSection.classList.remove('hidden');
      historySection.classList.remove('hidden');
    }
  });

  function showScrapeBlockedError(message) {
    loadingSection.classList.add('hidden');
    inputSection.classList.remove('hidden');
    historySection.classList.remove('hidden');
    
    // Auto toggle manual paste area
    if (!isManualVisible) {
      toggleManualBtn.click();
    }
    
    // Focus manual textarea
    manualTextInput.focus();
    manualTextInput.scrollIntoView({ behavior: 'smooth' });
  }

  function resetProgressSteps() {
    [stepGather, stepAi, stepRoute].forEach(step => {
      step.className = 'progress-step';
    });
  }

  function updateStepState(stepElement, state) {
    stepElement.classList.remove('active', 'done');
    if (state === 'active') {
      stepElement.classList.add('active');
    } else if (state === 'done') {
      stepElement.classList.add('done');
    }
  }

  // Render CRO Report Dashboard
  function renderReport(report, searchUrl) {
    activeAuditData = report;

    // Set grade and header details
    gradeValue.textContent = report.grade || 'B';
    resultBrandName.textContent = report.brandName || 'Brand Store';
    resultBrandUrl.textContent = searchUrl;
    resultSummary.textContent = report.summary || '';

    // Render prioritization table rows
    croTableBody.innerHTML = report.issues.map((issue, idx) => {
      const priorityClass = issue.priority.toLowerCase();
      return `
        <tr>
          <td><span class="priority-pill ${priorityClass}">${issue.priority}</span></td>
          <td><strong>${issue.category}</strong></td>
          <td>${issue.problem}</td>
          <td>${issue.recommendation}</td>
          <td>
            <div class="ice-metric-inline">
              I:${issue.impact} | E:${issue.effort} &rarr; <span class="ice-score-main">${issue.iceScore}</span>
            </div>
          </td>
          <td>
            <button class="btn btn-secondary view-brief-btn" data-index="${idx}">
              Create Brief
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Render detailed cards
    opportunitiesCardsContainer.innerHTML = report.issues.map((issue, idx) => {
      const priorityClass = issue.priority.toLowerCase();
      return `
        <div class="neumorphic-card opportunity-card animate-fade-in" style="animation-delay: ${idx * 0.1}s">
          <div class="card-top-row">
            <div class="card-meta-left">
              <span class="priority-pill ${priorityClass}">${issue.priority} Priority</span>
              <span class="category-well">${issue.category}</span>
            </div>
            
            <div class="card-metrics-right">
              <div class="metric-pill">
                <span class="metric-pill-label">Impact</span>
                <span class="metric-pill-value">${issue.impact}/10</span>
              </div>
              <div class="metric-pill">
                <span class="metric-pill-label">Confidence</span>
                <span class="metric-pill-value">${issue.confidence}/10</span>
              </div>
              <div class="metric-pill">
                <span class="metric-pill-label">Effort</span>
                <span class="metric-pill-value">${issue.effort}/10</span>
              </div>
              <div class="metric-pill ice-highlight">
                <span class="metric-pill-label">ICE Score</span>
                <span class="metric-pill-value">${issue.iceScore}</span>
              </div>
            </div>
          </div>

          <h4 class="font-display" style="font-size: 18px; margin-bottom: 16px;">${issue.problem}</h4>
          
          <div class="card-content-block">
            <div class="evidence-well">
              <h5 class="block-title">What is Wrong (Evidence)</h5>
              <p class="block-text">${issue.evidence}</p>
            </div>

            <div class="recommendation-well">
              <h5 class="block-title">Recommended Fix</h5>
              <p class="block-text">${issue.recommendation}</p>
            </div>

            <div class="comparison-well">
              <h5 class="block-title">Competitor Comparison / Standard</h5>
              <p class="block-text">${issue.competitorComparison}</p>
            </div>
          </div>

          <div style="margin-top: 24px; display: flex; justify-content: flex-end;">
            <button class="btn btn-primary view-brief-btn" data-index="${idx}">
              <span>Create Experiment Brief</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach click events for brief modals
    document.querySelectorAll('.view-brief-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = btn.getAttribute('data-index');
        const issue = report.issues[idx];
        if (issue && issue.brief) {
          openBriefModal(issue.brief);
        }
      });
    });
  }

  // Modal Open/Close handlers
  function openBriefModal(brief) {
    modalBriefTitle.textContent = `A/B Test Brief: ${brief.title}`;
    modalHypothesis.textContent = brief.hypothesis;
    modalControl.textContent = brief.control;
    modalVariant.textContent = brief.variant;
    modalMetric.textContent = brief.metric;
    modalDevTime.textContent = brief.devTime;
    
    briefModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // prevent scrolling behind modal
  }

  function closeBriefModal() {
    briefModal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  [closeModalBtn, closeModalFooterBtn].forEach(el => {
    el.addEventListener('click', closeBriefModal);
  });

  briefModal.addEventListener('click', (e) => {
    if (e.target === briefModal) {
      closeBriefModal();
    }
  });

  // Copy brief specifications to clipboard
  copyBriefBtn.addEventListener('click', () => {
    const textToCopy = `
📋 EXPERIMENT BLUEPRINT: ${modalBriefTitle.textContent}
==================================================
Core Hypothesis:
${modalHypothesis.textContent}

Control Layout (A):
${modalControl.textContent}

Variant Layout (B):
${modalVariant.textContent}

Primary Metric to Track:
${modalMetric.textContent}

Estimated Dev Time:
${modalDevTime.textContent}
==================================================
Generated by Helium CRO Engine.
    `.trim();

    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        const origText = copyBriefBtn.querySelector('span').textContent;
        copyBriefBtn.querySelector('span').textContent = 'Copied to Clipboard!';
        setTimeout(() => {
          copyBriefBtn.querySelector('span').textContent = origText;
        }, 2000);
      })
      .catch(err => {
        console.error('Failed to copy text:', err);
      });
  });

  // Load history list on startup
  loadHistory();
});
