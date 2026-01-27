declare module 'html2pdf.js' {
    interface Html2PdfOptions {
        margin?: number | number[];
        filename?: string;
        image?: {
            type?: 'jpeg' | 'png' | 'webp';
            quality?: number;
        };
        html2canvas?: {
            scale?: number;
            useCORS?: boolean;
            [key: string]: any;
        };
        jsPDF?: {
            unit?: 'pt' | 'mm' | 'cm' | 'in';
            format?: 'a4' | 'letter' | 'legal' | [number, number];
            orientation?: 'portrait' | 'landscape';
            [key: string]: any;
        };
        [key: string]: any;
    }

    interface Html2PdfInstance {
        set(options: Html2PdfOptions): Html2PdfInstance;
        from(element: HTMLElement | string): Html2PdfInstance;
        save(): Promise<void>;
        output(type: string, options?: any): Promise<any>;
        toPdf(): Html2PdfInstance;
    }

    function html2pdf(): Html2PdfInstance;

    export default html2pdf;
}
