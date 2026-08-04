import os
from fpdf import FPDF

class ManagementReportPDF(FPDF):
    def header(self):
        self.set_font('Helvetica', 'B', 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, 'FRAUD SUPPORT GAMIFIED ASSESSMENT PLATFORM -- MANAGEMENT GUIDE', 0, 0, 'R')
        self.ln(12)

    def footer(self):
        self.set_y(-15)
        self.set_font('Helvetica', 'I', 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, f'Page {self.page_no()}', 0, 0, 'C')

    def chapter_title(self, label):
        self.set_font('Helvetica', 'B', 14)
        self.set_text_color(30, 58, 138)  # Deep Blue
        self.cell(0, 6, label, 0, 1, 'L')
        self.set_draw_color(30, 58, 138)
        self.set_line_width(0.5)
        self.line(self.get_x(), self.get_y() + 2, self.get_x() + 190, self.get_y() + 2)
        self.ln(8)

    def section_subtitle(self, label):
        self.set_font('Helvetica', 'B', 11)
        self.set_text_color(55, 65, 81)  # Charcoal
        self.cell(0, 5, label, 0, 1, 'L')
        self.ln(2)

    def paragraph(self, text, style=''):
        self.set_font('Helvetica', style, 9.5)
        self.set_text_color(75, 85, 99)  # Gray
        self.multi_cell(0, 5, text)
        self.ln(3)

def create_report():
    pdf = ManagementReportPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    
    # Page 1: Cover & Introduction
    pdf.add_page()
    
    pdf.set_y(25)
    pdf.set_font('Helvetica', 'B', 22)
    pdf.set_text_color(30, 58, 138)  # Deep Blue
    pdf.cell(0, 10, 'Fraud Support Gamified Assessment', 0, 1, 'C')
    
    pdf.set_font('Helvetica', 'B', 14)
    pdf.set_text_color(107, 114, 128)  # Gray
    pdf.cell(0, 10, 'Platform Methodology, Scoring & Proctoring Guide', 0, 1, 'C')
    
    pdf.ln(5)
    pdf.set_draw_color(156, 163, 175)
    pdf.line(20, pdf.get_y(), 190, pdf.get_y())
    pdf.ln(10)

    pdf.chapter_title('1. Executive Overview')
    pdf.paragraph(
        'The Fraud Support Gamified Assessment Platform is a specialized evaluation tool designed specifically '
        'to evaluate candidate readiness for fraud operations roles. Operating in digital environments, fraud support '
        'agents require a unique mix of high verbal precision, analytical research skills, and critical thinking/logical judgment. '
        'The platform evaluates candidates dynamically through gamified, interactive scenarios while silently logging security '
        'indicators to protect test integrity.'
    )
    
    pdf.chapter_title('2. The 8 Assessment Zones & 3 Core Competencies')
    pdf.paragraph(
        'The assessment is divided into 8 distinct zones, structured to test core competencies across three primary functional areas:'
    )
    
    # English Competency
    pdf.set_font('Helvetica', 'B', 10)
    pdf.set_fill_color(243, 244, 246)
    pdf.set_text_color(30, 58, 138)
    pdf.cell(190, 6, ' COMPETENCY A: LANGUAGE & COMMUNICATION (ENGLISH)', 1, 1, 'L', True)
    
    zones_a = [
        ('Zone 1: Grammar', '60s', 'Multiple-choice testing of core grammar, subject-verb agreement, tense, and article rules.'),
        ('Zone 2: Sentence Correction', '60s', 'Free-form rewrites of incorrect/unprofessional client emails to ensure proper punctuation & tone.'),
        ('Zone 3: Macro Editing', '60s', 'Refinement of canned replies in-place, transforming robotic text into empathetic customer interactions.'),
        ('Zone 4: Reading Comprehension', '180s', 'Analysis of customer claims. Tests retention of critical numbers, transaction dates, and core complaints.'),
        ('Zone 5: Case Closure Notes', '60s', 'Selecting final ticket status and composing 1-2 sentence summaries for audit trail logging.')
    ]
    
    pdf.set_font('Helvetica', '', 8.5)
    pdf.set_text_color(55, 65, 81)
    pdf.set_fill_color(255, 255, 255) # Reset fill color to white for table cells
    with pdf.table(col_widths=(45, 20, 125)) as table:
        for title, limit, desc in zones_a:
            row = table.row()
            row.cell(title)
            row.cell(limit)
            row.cell(desc)
    pdf.ln(4)

    # Attention to Detail (Research) Competency
    pdf.set_font('Helvetica', 'B', 10)
    pdf.set_fill_color(243, 244, 246)
    pdf.set_text_color(30, 58, 138)
    pdf.cell(190, 6, ' COMPETENCY B: ATTENTION TO DETAIL (RESEARCH)', 1, 1, 'L', True)
    
    zones_b = [
        ('Zone 6: Attention (L1)', '120s', 'Spotting immediate mismatches/omissions (e.g. invoice/transaction gap) on a single case dashboard.'),
        ('Zone 7: Attention (L2)', '120s', 'Cross-referencing multiple tabs (Profile, Notes, Ledger) to detect subtle names/accounts inconsistencies.')
    ]
    
    pdf.set_font('Helvetica', '', 8.5)
    pdf.set_text_color(55, 65, 81)
    pdf.set_fill_color(255, 255, 255) # Reset fill color to white
    with pdf.table(col_widths=(45, 20, 125)) as table:
        for title, limit, desc in zones_b:
            row = table.row()
            row.cell(title)
            row.cell(limit)
            row.cell(desc)
    pdf.ln(4)

    # Critical Thinking Competency
    pdf.set_font('Helvetica', 'B', 10)
    pdf.set_fill_color(243, 244, 246)
    pdf.set_text_color(30, 58, 138)
    pdf.cell(190, 6, ' COMPETENCY C: CRITICAL THINKING & DECISION MAKING', 1, 1, 'L', True)
    
    zones_c = [
        ('Zone 8: Critical Thinking', '180s', 'Weighing risk vectors (OTP failure + IP location switch) to determine correct freezing and escalation path.')
    ]
    
    pdf.set_font('Helvetica', '', 8.5)
    pdf.set_text_color(55, 65, 81)
    pdf.set_fill_color(255, 255, 255) # Reset fill color to white
    with pdf.table(col_widths=(45, 20, 125)) as table:
        for title, limit, desc in zones_c:
            row = table.row()
            row.cell(title)
            row.cell(limit)
            row.cell(desc)
        
    pdf.add_page()
    
    pdf.chapter_title('3. Grading Architecture & Buckets')
    pdf.paragraph(
        'The candidate\'s performance is graded and grouped automatically into the three competency buckets '
        'by our Google Apps Script (GAS) backend (Code.gs and AsyncGrading.gs) based on the question metadata. '
        'Here is how the system directs and evaluates answers:'
    )
    
    pdf.set_font('Helvetica', 'B', 9.5)
    pdf.set_text_color(30, 58, 138)
    pdf.cell(0, 5, 'Grading Source & Mechanics', 0, 1)
    pdf.paragraph(
        '- English (Language) Bucket: Grades are sourced from Zones 1 to 5. Multiple-choice questions are auto-graded '
        'upon submission by comparing selection indices. Free-form text fields (Sentence Correction and Macro Editing) '
        'are graded based on predefined correct patterns or queued for reviewer inspection.\n'
        '- Attention (Research) Bucket: Sourced from Zones 6 and 7. The system evaluates whether candidates correctly identify '
        'omissions or mismatches in the dashboard and multi-tab interface questions.\n'
        '- Critical Thinking Bucket: Sourced from Zone 8. Candidates choose response strategies for fraud incidents. '
        'Answers are graded according to correct risk escalation and mitigation frameworks.'
    )
    
    pdf.set_font('Helvetica', 'B', 9.5)
    pdf.set_text_color(30, 58, 138)
    pdf.cell(0, 5, 'The A2 Fair Grading Policy', 0, 1)
    pdf.paragraph(
        'Under the A2 policy, the denominator of any percentage score excludes ungraded items. If a question '
        'is flagged as "ungraded" (e.g. pending recruiter audit), it is removed from the total questions count. '
        'This ensures that unresolved manual grading questions do not penalize the candidate\'s overall status.'
    )

    pdf.chapter_title('4. Advisory Recommendation Tiers')
    pdf.paragraph(
        'Following grading, candidates are automatically placed into one of three Recommendation Tiers. '
        'Note that these categories are strictly advisory; the platform never executes auto-rejections, leaving the final decision '
        'to the recruiting team.'
    )
    
    # Recommendation Tiers Table
    pdf.set_font('Helvetica', '', 8)
    pdf.set_text_color(55, 65, 81)
    pdf.set_fill_color(255, 255, 255) # Reset fill color to white for table cells
    
    with pdf.table(col_widths=(35, 25, 55, 75)) as table:
        # Header Row
        row = table.row()
        row.cell('Recommendation Tier')
        row.cell('Min. Overall Score')
        row.cell('Specific Competency Hurdles')
        row.cell('Hiring Advisory Description')
        
        # Data Rows
        row = table.row()
        row.cell('Strong Fit')
        row.cell('>= 80%')
        row.cell('>= 75% Critical Thinking AND\n>= 75% Research (Attention)')
        row.cell('Excel under ambiguity. Proven analytical and language capabilities. Highly recommended.')
        
        row = table.row()
        row.cell('Consider')
        row.cell('>= 60%')
        row.cell('None')
        row.cell('Solid baseline skill sets. Likely needs minor coaching on complex fraud logic/edge-cases.')
        
        row = table.row()
        row.cell('Not Recommended')
        row.cell('< 60%')
        row.cell('None')
        row.cell('Candidate falls below the minimum proficiency. Substantial training required.')
        
    pdf.ln(4)
    
    pdf.section_subtitle('Recruiter Verdict Override')
    pdf.paragraph(
        'Recruiters have the ability to review any candidate response (such as manual free-text inputs) and override '
        'a graded verdict (e.g. converting a system-marked Incorrect to Correct). Changing any verdict triggers '
        'an immediate, real-time re-aggregation of all scores, narrative insights, and recommendation tiers.'
    )

    pdf.add_page()

    pdf.chapter_title('5. Proctoring Capabilities')
    pdf.paragraph(
        'To ensure exam security, a comprehensive monitoring suite operates quietly in the background '
        'without interrupting the candidate during the assessment. Captured behaviors include:'
    )
    
    proctor_items = [
        ('1. Window Blur & Tab Switches', 'Tracks each instance where a candidate leaves the assessment tab (e.g. to search the web or open another application). Logs the exact timestamp and duration in seconds.'),
        ('2. Copy / Cut / Paste Detection', 'Logs all attempts to copy content out of the test or paste external content (e.g. AI-generated answers) into writing prompts.'),
        ('3. Developer Tools Check', 'Uses a window dimension heuristic (measuring window outer vs. inner width/height) to detect if a candidate opens developer consoles.'),
        ('4. Fullscreen Enforcement', 'Examines browser fullscreen status. If the candidate exits fullscreen, the system records it silently.'),
        ('5. Webcam Face Recognition', 'If enabled, TensorFlow.js BlazeFace model runs client-side every 3 seconds to verify if a face is missing or if multiple people are in front of the camera.')
    ]
    
    for title, desc in proctor_items:
        pdf.set_font('Helvetica', 'B', 9)
        pdf.set_text_color(55, 65, 81)
        pdf.cell(0, 5, title, 0, 1)
        pdf.set_font('Helvetica', '', 8.5)
        pdf.set_text_color(107, 114, 128)
        pdf.multi_cell(0, 4, desc)
        pdf.ln(2)
        
    pdf.chapter_title('6. Integrity Violation Evaluation Matrix')
    pdf.paragraph(
        'Integrity violations are logged silently to prevent testing anxiety. Recruiters should review logs using '
        'the following risk guidelines:'
    )
    
    # Interpretation Matrix
    pdf.set_font('Helvetica', '', 7.5)
    pdf.set_text_color(55, 65, 81)
    pdf.set_fill_color(255, 255, 255) # Reset fill color to white for table cells
    
    with pdf.table(col_widths=(40, 20, 60, 70)) as table:
        # Header Row
        row = table.row()
        row.cell('Violation Type')
        row.cell('Risk Level')
        row.cell('Common Benign Causes')
        row.cell('Red Flags / Actions')
        
        # Data Rows
        violations = [
            ('Tab Switch / Blur', 'Low', 'System notifications, clicking a volume slider.', 'Frequent switches (>10) or long blur durations (>60s).'),
            ('Fullscreen Exit', 'Low', 'Accidental keypress, OS popups.', 'Exiting fullscreen combined with immediate copy-pastes.'),
            ('Copy / Cut / Paste', 'Medium', 'Copying reference numbers from the text.', 'Pasting long text blocks into response text areas.'),
            ('Dev Tools Resize', 'Medium', 'Resizing browser to adjust screen layout.', 'Recurrent resize events during critical thinking zones.'),
            ('Webcam: No Face', 'Medium', 'Adjusting posture, picking up a pen.', 'Webcam blocked or face missing for >15 consecutive seconds.'),
            ('Webcam: Multi-Face', 'High', 'Family member walking in background.', 'Active collaboration or secondary face looking at screen.')
        ]
        for vtype, risk, benign, red in violations:
            row = table.row()
            row.cell(vtype)
            row.cell(risk)
            row.cell(benign)
            row.cell(red)
            
    pdf.ln(4)
    
    pdf.set_font('Helvetica', 'B', 9.5)
    pdf.set_text_color(30, 58, 138)
    pdf.cell(0, 5, 'Strategic Recommendation for Leadership', 0, 1)
    pdf.paragraph(
        'Integrity warnings should be treated as risk indicators rather than auto-fail criteria. A candidate with a high '
        'violation score should be manually reviewed by evaluating their free-text notes, or scheduled for a brief '
        'follow-up interview to confirm competency. This ensures we do not disqualify excellent candidates due to minor '
        'system alerts.'
    )

    # Save to file
    output_path = 'c:\\Users\\anoop\\OneDrive\\Desktop\\FS-gamified-assessment\\assessment_methodology.pdf'
    pdf.output(output_path)
    print(f"PDF successfully generated at {output_path}")

if __name__ == '__main__':
    create_report()
