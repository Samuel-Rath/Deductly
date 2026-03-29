# Page snapshot

```yaml
- generic [ref=e3]:
  - link "Skip to main content" [ref=e4] [cursor=pointer]:
    - /url: "#main"
  - navigation [ref=e5]:
    - generic [ref=e8]:
      - link "Deductly" [ref=e9] [cursor=pointer]:
        - /url: /
        - generic [ref=e10]: Deductly
      - generic [ref=e11]:
        - link "Get Started" [ref=e12] [cursor=pointer]:
          - /url: /upload
        - button "Open menu" [ref=e13] [cursor=pointer]
  - main [ref=e17]:
    - generic [ref=e19]:
      - generic [ref=e20]:
        - heading "Upload Your Bank Statement" [level=1] [ref=e21]
        - paragraph [ref=e22]: We'll analyse your transactions and identify potential tax deductions
      - generic [ref=e24]:
        - generic [ref=e25]:
          - generic [ref=e26]: Bank Statement
          - button "Upload bank statement - drag and drop or click to browse" [ref=e27] [cursor=pointer]:
            - generic [ref=e28]:
              - img [ref=e29]
              - generic [ref=e32]: Drop your file here
              - generic [ref=e33]: CSV or PDF • or click to browse
          - paragraph [ref=e34]: Accepts CSV and PDF files • Maximum 10MB
        - generic [ref=e35]:
          - img [ref=e36]
          - paragraph [ref=e39]: Your data is processed in memory and deleted immediately after your report is generated. Nothing is stored.
        - generic [ref=e40]:
          - button "Back" [ref=e41] [cursor=pointer]
          - button "Start Analysis" [disabled]
      - generic [ref=e42]:
        - heading "Supported Formats" [level=3] [ref=e43]
        - paragraph [ref=e44]: We support CSV and PDF bank statements from CommBank, NAB, Westpac, ANZ, and ING. The income year will be automatically detected from your transaction dates.
```